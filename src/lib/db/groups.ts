import pool from "../db";
import type { GroupDetail, GroupMember, GroupMessage, GroupRole, GroupSummary, LeagueEntry, MessageReactionSummary } from "@/types";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseEnum, parseNumber, parseProfileId, parseTitle, ValidationError } from "./validation";
import { areFriends } from "./social";
import { getWeeklyFocusMinutesForProfiles } from "./focus";
import { sundayWeekStartIso, todayIso } from "./dates";
import { xpFromMinutes } from "./league";
import { getGroupTotalMinutes, getGroupMemberContributions, getGroupGlobalRank, getPeriodRange, type Period } from "./group-leaderboard";

const GROUP_EMOJIS = new Set(["⚡", "🔥", "✨", "💎", "🌙", "☀️", "🌊", "🌿", "🎯", "💜", "🌀", "⭐", "🚀", "🧠"]);

/** Helper to resolve a group membership's role + ban state in one query. */
async function resolveMember(
  groupId: number,
  profileId: string,
): Promise<{ role: GroupRole; isBanned: boolean } | null> {
  const result = await pool.query<{ role: string; is_banned: boolean }>(
    `select role, coalesce(is_banned, false) as is_banned from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { role: row.role as GroupRole, isBanned: row.is_banned };
}

/** Can the actor promote/demote the target to the requested role? Only owner. */
export function canPromote(
  actorRole: GroupRole | null,
  targetRole: GroupRole,
  requestedRole: GroupRole,
): boolean {
  if (actorRole !== "OWNER") return false;
  if (targetRole === "OWNER") return false; // owner cannot be re-role'd
  if (requestedRole === "OWNER") return false; // ownership via transfer only
  if (requestedRole === targetRole) return false;
  return true;
}

/** Can the actor ban the target? Owner bans anyone except self; admin bans members only. */
export function canBan(actorRole: GroupRole | null, targetProfileId: string, actorProfileId: string, targetRole: GroupRole): boolean {
  if (!actorRole) return false;
  if (actorProfileId === targetProfileId) return false; // cannot ban self
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}

/** Can the actor kick (remove) the target? Owner only. */
export function canKick(actorRole: GroupRole | null, actorProfileId: string, targetProfileId: string, targetRole: GroupRole): boolean {
  if (!actorRole || actorRole !== "OWNER") return false;
  if (actorProfileId === targetProfileId) return false; // cannot kick self
  if (targetRole === "OWNER") return false; // owner is protected
  return true;
}

/** Can the actor edit group settings (description / icon)? Owner only. */
export function canEditGroupSettings(actorRole: GroupRole | null): boolean {
  return actorRole === "OWNER";
}

/** Can the actor delete a message sent by the target role? Owner deletes anyone; admin deletes members only. */
export function canDeleteMessageGroup(actorRole: GroupRole | null, messageSenderId: string, actorProfileId: string, senderRole: GroupRole): boolean {
  if (!actorRole) return false;
  if (actorProfileId === messageSenderId) return true; // always allowed to delete own message
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return senderRole === "MEMBER";
  return false;
}

/** Detect whether a column exists on a table (cached, so we don't pay on every call). */
const columnCache = new Map<string, Promise<boolean>>();
function hasColumn(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (!columnCache.has(key)) {
    columnCache.set(
      key,
      pool
        .query<{ exists: boolean }>(
          `select exists (
             select 1 from information_schema.columns
             where table_name = $1 and column_name = $2
           ) as exists`,
          [table, column],
        )
        .then((r) => r.rows[0]?.exists ?? false)
        .catch(() => false),
    );
  }
  return columnCache.get(key)!;
}

interface GroupRow {
  id: string | number;
  name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  created_by: string;
  created_at: Date | string;
  description: string | null;
  is_public: boolean;
}

/** Mute or unmute a regular member. Admins cannot moderate owners or admins. */
export async function setMemberMuted(
  profileId: string,
  groupId: number,
  targetProfileId: string,
  muted: boolean,
): Promise<void> {
  parseProfileId(profileId);
  parseProfileId(targetProfileId);
  const actorRole = await getMemberRole(profileId, groupId);
  const targetRole = await getMemberRole(targetProfileId, groupId);
  if (!actorRole || !targetRole) throw new NotFoundError("Membro não encontrado.");
  if (!["OWNER", "ADMIN"].includes(actorRole)) throw new ForbiddenError("Só dono ou administrador pode silenciar membros.");
  if (targetProfileId === profileId || targetRole !== "MEMBER") {
    throw new ForbiddenError("Apenas membros comuns podem ser silenciados.");
  }
  await pool.query(
    `update group_members set is_muted = $1 where group_id = $2 and profile_id = $3`,
    [muted, groupId, targetProfileId],
  );
}

async function assertMember(groupId: number, profileId: string): Promise<void> {
  const result = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
  if (!result.rows[0]) throw new ForbiddenError("Você não faz parte deste grupo.");
}

/** Ban or unban a member. Owner can ban anyone; admin can ban members only. */
export async function setMemberBanned(
  profileId: string,
  groupId: number,
  targetProfileId: string,
  banned: boolean,
): Promise<void> {
  parseProfileId(profileId);
  parseProfileId(targetProfileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");

  const actor = await resolveMember(groupId, profileId);
  if (!actor) throw new ForbiddenError("Você não faz parte deste grupo.");
  const target = await resolveMember(groupId, targetProfileId);
  if (!target) throw new NotFoundError("Membro não encontrado.");

  if (!canBan(actor.role, targetProfileId, profileId, target.role)) {
    throw new ForbiddenError("Você não tem permissão para banir este membro.");
  }

  await pool.query(
    `update group_members set is_banned = $1 where group_id = $2 and profile_id = $3`,
    [banned, groupId, targetProfileId],
  );
}

function normalizeReactions(value: unknown): MessageReactionSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const emoji = typeof row.emoji === "string" ? row.emoji : "";
      const count = Number(row.count ?? 0);
      const userNames = Array.isArray(row.userNames)
        ? row.userNames.filter((name): name is string => typeof name === "string")
        : [];
      if (!emoji || count <= 0) return null;
      return {
        emoji,
        count,
        userNames,
        reactedByMe: Boolean(row.reactedByMe),
      };
    })
    .filter((item): item is MessageReactionSummary => item !== null);
}

export async function listGroups(profileId: string): Promise<GroupSummary[]> {
  parseProfileId(profileId);
  const weekStart = sundayWeekStartIso(todayIso());
  const result = await pool.query<
    GroupRow & { member_count: string | number; unread: string | number }
  >(
    `select g.id, g.name, g.avatar_emoji, g.avatar_url, g.created_by, g.created_at,
            (select count(*) from group_members m where m.group_id = g.id) as member_count,
            (
              select count(*)::int from group_messages gm
              where gm.group_id = g.id and gm.sender_id <> $1
                and gm.created_at > coalesce(
                  (select read_at from group_reads r where r.profile_id = $1 and r.group_id = g.id),
                  'epoch'::timestamptz
                )
            ) as unread
     from groups g
     join group_members me on me.group_id = g.id and me.profile_id = $1
     order by g.created_at desc`,
    [profileId],
  );

  const groups = result.rows;
  const memberIdsByGroup = await Promise.all(
    groups.map(async (group) => {
      const members = await pool.query<{ profile_id: string }>(
        `select profile_id from group_members where group_id = $1`,
        [group.id],
      );
      return { id: Number(group.id), ids: members.rows.map((row) => row.profile_id) };
    }),
  );

  const allIds = [...new Set(memberIdsByGroup.flatMap((item) => item.ids))];
  const minutes = await getWeeklyFocusMinutesForProfiles(allIds, weekStart);
  const minutesByGroup = new Map<number, number>();
  for (const item of memberIdsByGroup) {
    minutesByGroup.set(
      item.id,
      item.ids.reduce((sum, id) => sum + (minutes.get(id) ?? 0), 0),
    );
  }

  return groups.map((row) => ({
    id: Number(row.id),
    name: row.name,
    avatarEmoji: row.avatar_emoji,
    avatarUrl: row.avatar_url ?? undefined,
    memberCount: Number(row.member_count),
    weeklyFocusMinutes: minutesByGroup.get(Number(row.id)) ?? 0,
    unreadCount: Number(row.unread),
  }));
}

export async function createGroup(
  profileId: string,
  input: { name: string; avatarEmoji?: string; avatarUrl?: string; description?: string; isPublic?: boolean; inviteIds?: string[] },
): Promise<GroupDetail> {
  parseProfileId(profileId);
  const name = parseTitle(input.name, "Nome do grupo");
  const emoji = input.avatarEmoji?.trim() || "⚡";
  if (!GROUP_EMOJIS.has(emoji)) throw new ValidationError("Escolha um emoji da lista.");
  const avatarUrl = input.avatarUrl?.trim() || null;
  if (avatarUrl && (!avatarUrl.startsWith("data:image/") || avatarUrl.length > 9_400_000)) {
    throw new ValidationError("Imagem inválida ou muito grande (máx. ~7 MB).");
  }
  
  const description = input.description?.trim() || null;
  const isPublic = input.isPublic ?? false;

  const inviteIds = [...new Set((input.inviteIds ?? []).map((id) => parseProfileId(id)))].filter((id) => id !== profileId);
  for (const id of inviteIds) {
    if (!(await areFriends(profileId, id))) {
      throw new ForbiddenError("Você só pode convidar amigos para o grupo.");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const created = await client.query<GroupRow>(
      `insert into groups (name, avatar_emoji, avatar_url, description, is_public, created_by)
       values ($1, $2, $3, $4, $5, $6)
       returning id, name, avatar_emoji, avatar_url, created_by, created_at, description, is_public`,
      [name, emoji, avatarUrl, description, isPublic, profileId],
    );
    const group = created.rows[0];
    await client.query(
      `insert into group_members (group_id, profile_id, role) values ($1, $2, 'OWNER')`,
      [group.id, profileId],
    );
    for (const id of inviteIds) {
      await client.query(
        `insert into group_members (group_id, profile_id, role) values ($1, $2, 'MEMBER')
         on conflict do nothing`,
        [group.id, id],
      );
    }
    await client.query("commit");
    return getGroupDetail(profileId, Number(group.id));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a group chat with users identified by their usernames (@ handles)
 * This allows creating groups without requiring prior friendship
 * Users who are not friends will be added as members but won't have full access
 * until they accept or until friendship is established
 */
export async function createGroupWithUsernames(
  profileId: string,
  input: { 
    name: string; 
    avatarEmoji?: string; 
    avatarUrl?: string;
    description?: string; 
    isPublic?: boolean; 
    memberUsernames?: string[] 
  },
): Promise<GroupDetail> {
  parseProfileId(profileId);
  const name = parseTitle(input.name, "Nome do grupo");
  const emoji = input.avatarEmoji?.trim() || "⚡";
  if (!GROUP_EMOJIS.has(emoji)) throw new ValidationError("Escolha um emoji da lista.");
  const avatarUrl = input.avatarUrl?.trim() || null;
  if (avatarUrl && (!avatarUrl.startsWith("data:image/") || avatarUrl.length > 9_400_000)) {
    throw new ValidationError("Imagem inválida ou muito grande (máx. ~7 MB).");
  }
  
  const description = input.description?.trim() || null;
  const isPublic = input.isPublic ?? false;

  // Resolve usernames to profile IDs
  const usernames = [...new Set((input.memberUsernames ?? []))].filter((u) => u && u !== profileId);
  const userIdMap = new Map<string, string>();
  
  if (usernames.length > 0) {
    const result = await pool.query<{ id: string; username: string }>(
      `select id, username from profiles where lower(username) = any(lower($1::text[]))`,
      [usernames],
    );
    
    for (const row of result.rows) {
      userIdMap.set(row.username.toLowerCase(), row.id);
    }
    
    // Check if all usernames were found
    for (const username of usernames) {
      if (!userIdMap.has(username.toLowerCase())) {
        throw new NotFoundError(`Usuário @${username} não encontrado.`);
      }
    }
  }

  const inviteIds = Array.from(userIdMap.values()).filter((id) => id !== profileId);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const created = await client.query<GroupRow>(
      `insert into groups (name, avatar_emoji, avatar_url, description, is_public, created_by)
       values ($1, $2, $3, $4, $5, $6)
       returning id, name, avatar_emoji, avatar_url, created_by, created_at, description, is_public`,
      [name, emoji, avatarUrl, description, isPublic, profileId],
    );
    const group = created.rows[0];
    await client.query(
      `insert into group_members (group_id, profile_id, role) values ($1, $2, 'OWNER')`,
      [group.id, profileId],
    );
    for (const id of inviteIds) {
      await client.query(
        `insert into group_members (group_id, profile_id, role) values ($1, $2, 'MEMBER')
         on conflict do nothing`,
        [group.id, id],
      );
    }
    await client.query("commit");
    return getGroupDetail(profileId, Number(group.id));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getGroupDetail(profileId: string, groupId: number, period: Period = "WEEK"): Promise<GroupDetail> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  await assertMember(groupId, profileId);
  const group = await pool.query<GroupRow>(
    `select id, name, avatar_emoji, avatar_url, created_by, created_at, description, is_public from groups where id = $1`,
    [groupId],
  );
  if (!group.rows[0]) throw new NotFoundError("Grupo não encontrado.");

  const members = await pool.query<
    {
      id: string;
      display_name: string;
      username: string | null;
      photo_url: string | null;
      role: "OWNER" | "ADMIN" | "MEMBER";
      is_muted: boolean;
      is_banned: boolean;
      current_streak: number | null;
    }
  >(
    `select p.id, p.display_name, p.username, p.photo_url, m.role, m.is_muted, m.is_banned, p.current_streak
     from group_members m
     join profiles p on p.id = m.profile_id
     where m.group_id = $1
     order by m.role desc, p.display_name asc`,
    [groupId],
  );

  // Get period-scoped focus minutes using the new leaderboard system
  let periodMinutes = 0;
  try {
    periodMinutes = await getGroupTotalMinutes(groupId, period);
  } catch (err) {
    console.error("[getGroupDetail] getGroupTotalMinutes failed, defaulting to 0", err);
  }

  const mapped: GroupMember[] = members.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    role: row.role,
    isMuted: row.is_muted,
    isBanned: row.is_banned,
    currentStreak: row.current_streak ?? 0,
  }));

  const row = group.rows[0];
  return {
    id: Number(row.id),
    name: row.name,
    avatarEmoji: row.avatar_emoji,
    avatarUrl: row.avatar_url ?? undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    members: mapped,
    weeklyFocusMinutes: periodMinutes, // Using period-scoped minutes
    description: row.description ?? undefined,
    isPublic: row.is_public,
  };
}

export async function getGroupLeaderboard(profileId: string, groupId: number): Promise<LeagueEntry[]> {
  const detail = await getGroupDetail(profileId, groupId);
  const weekStart = sundayWeekStartIso(todayIso());
  const minutes = await getWeeklyFocusMinutesForProfiles(
    detail.members.map((member) => member.id),
    weekStart,
  );
  const ranked = [...detail.members]
    .map((member) => ({
      profileId: member.id,
      displayName: member.displayName,
      username: member.username,
      photoUrl: member.photoUrl,
      xp: xpFromMinutes(minutes.get(member.id) ?? 0, member.currentStreak),
      rank: 0,
      currentStreak: member.currentStreak,
      isCurrentUser: member.id === profileId,
      isFriend: member.id !== profileId,
    }))
    .sort((a, b) => b.xp - a.xp || a.displayName.localeCompare(b.displayName));

  return ranked.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function listGroupMessages(
  profileId: string,
  groupId: number,
  afterId?: number,
): Promise<GroupMessage[]> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  await assertMember(groupId, profileId);

  type MsgRow = {
    id: string | number;
    group_id: string | number;
    sender_id: string;
    body: string | null;
    message_type: string;
    media_url: string | null;
    media_duration_seconds: string | number | null;
    created_at: Date | string;
    reply_to_id: string | number | null;
    reply_to_body: string | null;
    reply_to_sender_name: string | null;
    edited_at: Date | string | null;
    display_name: string;
    photo_url: string | null;
    sender_role: string | null;
    reactions: unknown;
    is_pinned: boolean | null;
    pinned_at: Date | string | null;
    pinned_by: string | null;
  };
  // The reply/edit columns may not exist on older databases until the
  // migration runs; detect them so the query stays valid either way.
  const hasReplyCols = await hasColumn("group_messages", "reply_to_id");
  const baseColumns = `gm.id, gm.group_id, gm.sender_id, gm.body, gm.message_type,
     gm.media_url, gm.media_duration_seconds, gm.created_at, p.display_name, p.photo_url,
     gmsender.role as sender_role,
     reactions.reactions, (pinned.message_id is not null) as is_pinned,
     pinned.created_at as pinned_at, pinned.pinned_by`;
  const replyColumns = hasReplyCols
    ? `, gm.reply_to_id, gm.edited_at, rp.body as reply_to_body,
       rpname.display_name as reply_to_sender_name`
    : `, null::bigint as reply_to_id, null::timestamptz as edited_at,
       null::text as reply_to_body, null::text as reply_to_sender_name`;
  const selectColumns = baseColumns + replyColumns;

  const result = afterId
    ? await pool.query<MsgRow>(
        `select ${selectColumns}
         from group_messages gm
         join profiles p on p.id = gm.sender_id
         left join group_members gmsender on gmsender.group_id = gm.group_id and gmsender.profile_id = gm.sender_id
         ${hasReplyCols ? `left join group_messages rp on rp.id = gm.reply_to_id
         left join profiles rpname on rpname.id = rp.sender_id` : ""}
         left join lateral (
           select coalesce(jsonb_agg(jsonb_build_object(
             'emoji', grouped.emoji,
             'count', grouped.reaction_count,
             'userNames', grouped.user_names,
             'reactedByMe', grouped.reacted_by_me
           ) order by grouped.emoji), '[]'::jsonb) as reactions
           from (
             select mr.emoji,
                    count(*)::int as reaction_count,
                    array_agg(rp.display_name order by rp.display_name) as user_names,
                    bool_or(mr.user_id = $3) as reacted_by_me
             from message_reactions mr
             join profiles rp on rp.id = mr.user_id
             where mr.message_kind = 'GROUP' and mr.message_id = gm.id
             group by mr.emoji
           ) grouped
         ) reactions on true
         left join pinned_messages pinned
           on pinned.message_kind = 'GROUP'
          and pinned.conversation_id = gm.group_id::text
          and pinned.message_id = gm.id
         where gm.group_id = $1 and gm.id > $2
         order by gm.created_at asc
         limit 100`,
        [groupId, afterId, profileId],
      )
    : await pool.query<MsgRow>(
        `select ${selectColumns}
         from group_messages gm
         join profiles p on p.id = gm.sender_id
         left join group_members gmsender on gmsender.group_id = gm.group_id and gmsender.profile_id = gm.sender_id
         ${hasReplyCols ? `left join group_messages rp on rp.id = gm.reply_to_id
         left join profiles rpname on rpname.id = rp.sender_id` : ""}
         left join lateral (
           select coalesce(jsonb_agg(jsonb_build_object(
             'emoji', grouped.emoji,
             'count', grouped.reaction_count,
             'userNames', grouped.user_names,
             'reactedByMe', grouped.reacted_by_me
           ) order by grouped.emoji), '[]'::jsonb) as reactions
           from (
             select mr.emoji,
                    count(*)::int as reaction_count,
                    array_agg(rp.display_name order by rp.display_name) as user_names,
                    bool_or(mr.user_id = $2) as reacted_by_me
             from message_reactions mr
             join profiles rp on rp.id = mr.user_id
             where mr.message_kind = 'GROUP' and mr.message_id = gm.id
             group by mr.emoji
           ) grouped
         ) reactions on true
         left join pinned_messages pinned
           on pinned.message_kind = 'GROUP'
          and pinned.conversation_id = gm.group_id::text
          and pinned.message_id = gm.id
         where gm.group_id = $1
         order by gm.created_at desc
         limit 80`,
        [groupId, profileId],
      );

  const rows = afterId ? result.rows : [...result.rows].reverse();
  return rows.map((row) => ({
    id: Number(row.id),
    groupId: Number(row.group_id),
    senderId: row.sender_id,
    senderName: row.display_name,
    senderPhotoUrl: row.photo_url ?? undefined,
    senderRole: row.sender_role ? (row.sender_role as GroupRole) : undefined,
    body: row.body ?? undefined,
    messageType: (row.message_type as GroupMessage["messageType"]) || "TEXT",
    mediaUrl: row.media_url ?? undefined,
    mediaDurationSeconds: row.media_duration_seconds != null ? Number(row.media_duration_seconds) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    replyToId: row.reply_to_id != null ? Number(row.reply_to_id) : undefined,
    replyToBody: row.reply_to_body ?? undefined,
    replyToSenderName: row.reply_to_sender_name ?? undefined,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
    reactions: normalizeReactions(row.reactions),
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).toISOString() : undefined,
    pinnedBy: row.pinned_by ?? undefined,
  }));
}

export async function sendGroupMessage(
  profileId: string,
  groupId: number,
  body: string,
  opts?: { messageType?: string; mediaUrl?: string; mediaDurationSeconds?: number; replyToId?: number },
): Promise<GroupMessage> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  await assertMember(groupId, profileId);
  const membership = await pool.query<{ is_muted: boolean; is_banned: boolean }>(
    `select is_muted, coalesce(is_banned, false) as is_banned from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
  if (membership.rows[0]?.is_banned) throw new ForbiddenError("Você está banido deste grupo.");
  if (membership.rows[0]?.is_muted) throw new ForbiddenError("Você está silenciado neste grupo.");

  const messageType = (opts?.messageType ?? "TEXT") as GroupMessage["messageType"];
  const allowed: GroupMessage["messageType"][] = ["TEXT", "IMAGE", "VIDEO", "STICKER", "AUDIO"];
  if (!allowed.includes(messageType)) throw new ValidationError("Tipo de mensagem inválido.");

  let text: string | null = null;
  if (messageType === "TEXT") {
    text = parseTitle(body, "Mensagem");
    if (text.length > 2000) throw new ValidationError("Mensagem deve ter no máximo 2000 caracteres.");
  } else if (body && body.trim()) {
    text = body.trim().slice(0, 1000);
  }

  const mediaUrl = opts?.mediaUrl?.trim() || null;
  if (mediaUrl && mediaUrl.length > 2000) throw new ValidationError("URL de mídia inválida.");
  if (messageType !== "TEXT" && messageType !== "STICKER" && !mediaUrl) {
    throw new ValidationError("Mensagem de mídia requer uma URL.");
  }

  const mediaDurationSeconds =
    opts?.mediaDurationSeconds != null && Number.isFinite(opts.mediaDurationSeconds)
      ? Math.max(0, Math.round(opts.mediaDurationSeconds))
      : null;

  // Vídeos curtos (≤30s) para manter o chat leve; áudio também limitado.
  if ((messageType === "VIDEO" || messageType === "AUDIO") && mediaDurationSeconds != null && mediaDurationSeconds > 30) {
    throw new ValidationError("Vídeos e áudios devem ter no máximo 30 segundos.");
  }

  if (messageType === "STICKER" && !text) {
    text = opts?.mediaUrl?.trim() || null;
  }

  // Reply columns may not exist on older DBs until migration runs.
  const hasReplyCols = await hasColumn("group_messages", "reply_to_id");
  const effectiveReplyId = hasReplyCols ? opts?.replyToId : undefined;
  if (effectiveReplyId != null) {
    const reply = await pool.query<{ group_id: string | number }>(
      `select group_id from group_messages where id = $1`,
      [effectiveReplyId],
    );
    if (Number(reply.rows[0]?.group_id) !== groupId) {
      throw new ValidationError("Mensagem respondida inválida.");
    }
  }

  const inserted = await pool.query<{
    id: string | number;
    group_id: string | number;
    sender_id: string;
    body: string | null;
    message_type: string;
    media_url: string | null;
    media_duration_seconds: string | number | null;
    created_at: Date | string;
    reply_to_id: string | number | null;
    edited_at: Date | string | null;
  }>(
    hasReplyCols
      ? `insert into group_messages (group_id, sender_id, body, message_type, media_url, media_duration_seconds, reply_to_id)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, group_id, sender_id, body, message_type, media_url, media_duration_seconds, created_at, reply_to_id, edited_at`
      : `insert into group_messages (group_id, sender_id, body, message_type, media_url, media_duration_seconds)
         values ($1, $2, $3, $4, $5, $6)
         returning id, group_id, sender_id, body, message_type, media_url, media_duration_seconds, created_at`,
    hasReplyCols
      ? [groupId, profileId, text, messageType, mediaUrl, mediaDurationSeconds, effectiveReplyId ?? null]
      : [groupId, profileId, text, messageType, mediaUrl, mediaDurationSeconds],
  );
  const row = inserted.rows[0];
  const sender = await pool.query<{ display_name: string; photo_url: string | null }>(
    `select display_name, photo_url from profiles where id = $1`,
    [profileId],
  );
  // Fetch reply join info
  let replyToBody: string | undefined;
  let replyToSenderName: string | undefined;
  if (hasReplyCols && effectiveReplyId != null && row.reply_to_id != null) {
    const rp = await pool.query<{ body: string | null; sender_id: string; display_name: string }>(
      `select rp.body, rp.sender_id, p.display_name
       from group_messages rp
       join profiles p on p.id = rp.sender_id
       where rp.id = $1`,
      [row.reply_to_id],
    );
    replyToBody = rp.rows[0]?.body ?? undefined;
    replyToSenderName = rp.rows[0]?.display_name ?? undefined;
  }
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    senderId: row.sender_id,
    senderName: sender.rows[0]?.display_name ?? "Você",
    senderPhotoUrl: sender.rows[0]?.photo_url ?? undefined,
    body: row.body ?? undefined,
    messageType: (row.message_type as GroupMessage["messageType"]) || "TEXT",
    mediaUrl: row.media_url ?? undefined,
    mediaDurationSeconds: row.media_duration_seconds != null ? Number(row.media_duration_seconds) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    replyToId: row.reply_to_id != null ? Number(row.reply_to_id) : undefined,
    replyToBody,
    replyToSenderName,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
  };
}

export async function editGroupMessage(
  profileId: string,
  groupId: number,
  messageId: number,
  newBody: string,
): Promise<GroupMessage> {
  parseProfileId(profileId);
  await assertMember(groupId, profileId);
  const text = parseTitle(newBody, "Mensagem");
  if (text.length > 2000) throw new ValidationError("Mensagem deve ter no máximo 2000 caracteres.");
  const result = await pool.query<{
    id: string | number;
    group_id: string | number;
    sender_id: string;
    body: string | null;
    message_type: string;
    media_url: string | null;
    media_duration_seconds: string | number | null;
    created_at: Date | string;
    reply_to_id: string | number | null;
    edited_at: Date | string | null;
  }>(
    `update group_messages
     set body = $1, edited_at = now()
     where id = $2 and group_id = $3 and sender_id = $4 and message_type = 'TEXT'
     returning id, group_id, sender_id, body, message_type, media_url, media_duration_seconds, created_at, reply_to_id, edited_at`,
    [text, messageId, groupId, profileId],
  );
  if (!result.rows[0]) throw new NotFoundError("Mensagem não encontrada.");
  const row = result.rows[0];
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    senderId: row.sender_id,
    senderName: "Você",
    body: row.body ?? undefined,
    messageType: "TEXT",
    mediaUrl: row.media_url ?? undefined,
    mediaDurationSeconds: row.media_duration_seconds != null ? Number(row.media_duration_seconds) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    replyToId: row.reply_to_id != null ? Number(row.reply_to_id) : undefined,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
  };
}

export async function deleteGroupMessage(
  profileId: string,
  groupId: number,
  messageId: number,
): Promise<void> {
  parseProfileId(profileId);
  await assertMember(groupId, profileId);
  const message = await pool.query<{ sender_id: string }>(
    `select sender_id from group_messages where id = $1 and group_id = $2`,
    [messageId, groupId],
  );
  const row = message.rows[0];
  if (!row) throw new NotFoundError("Mensagem não encontrada.");

  // Owner can delete any message; admin can delete member messages; anyone
  // can delete their own. Owner/admin messages are protected from admins.
  const senderRole = (await getMemberRole(row.sender_id, groupId)) ?? "MEMBER";
  const actor = await resolveMember(groupId, profileId);
  if (!canDeleteMessageGroup(actor?.role ?? null, row.sender_id, profileId, senderRole)) {
    throw new ForbiddenError("Você não tem permissão para apagar esta mensagem.");
  }

  const result = await pool.query(
    `delete from group_messages where id = $1 and group_id = $2`,
    [messageId, groupId],
  );
  if (result.rowCount === 0) throw new NotFoundError("Mensagem não encontrada.");
}

async function assertGroupMessageParticipant(
  profileId: string,
  messageId: number,
): Promise<{ id: number; groupId: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(messageId) || messageId <= 0) throw new ValidationError("Mensagem inválida.");
  const result = await pool.query<{ id: string | number; group_id: string | number }>(
    `select id, group_id from group_messages where id = $1`,
    [messageId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError("Mensagem não encontrada.");
  const groupId = Number(row.group_id);
  await assertMember(groupId, profileId);
  return { id: Number(row.id), groupId };
}

export async function toggleGroupMessageReaction(
  profileId: string,
  messageId: number,
  emojiValue: unknown,
): Promise<GroupMessage> {
  const emoji = parseEnum(emojiValue, ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const, "Emoji");
  const message = await assertGroupMessageParticipant(profileId, messageId);
  const existing = await pool.query(
    `select 1 from message_reactions
     where message_kind = 'GROUP' and message_id = $1 and user_id = $2 and emoji = $3`,
    [messageId, profileId, emoji],
  );
  if (existing.rows[0]) {
    await pool.query(
      `delete from message_reactions
       where message_kind = 'GROUP' and message_id = $1 and user_id = $2 and emoji = $3`,
      [messageId, profileId, emoji],
    );
  } else {
    await pool.query(
      `insert into message_reactions (message_id, message_kind, user_id, emoji)
       values ($1, 'GROUP', $2, $3)
       on conflict (message_id, message_kind, user_id, emoji) do nothing`,
      [messageId, profileId, emoji],
    );
  }
  const messages = await listGroupMessages(profileId, message.groupId);
  const updated = messages.find((item) => item.id === messageId);
  if (!updated) throw new NotFoundError("Mensagem não encontrada.");
  return updated;
}

export async function toggleGroupMessagePin(
  profileId: string,
  messageId: number,
): Promise<void> {
  const message = await assertGroupMessageParticipant(profileId, messageId);
  const conversationId = String(message.groupId);
  const existing = await pool.query(
    `select 1 from pinned_messages
     where message_kind = 'GROUP' and conversation_id = $1 and message_id = $2`,
    [conversationId, messageId],
  );
  if (existing.rows[0]) {
    await pool.query(
      `delete from pinned_messages
       where message_kind = 'GROUP' and conversation_id = $1 and message_id = $2`,
      [conversationId, messageId],
    );
    return;
  }
  await pool.query(
    `delete from pinned_messages where message_kind = 'GROUP' and conversation_id = $1`,
    [conversationId],
  );
  await pool.query(
    `insert into pinned_messages (message_id, message_kind, conversation_id, pinned_by)
     values ($1, 'GROUP', $2, $3)
     on conflict (message_id, message_kind) do update
     set conversation_id = excluded.conversation_id,
         pinned_by = excluded.pinned_by,
         created_at = now()`,
    [messageId, conversationId, profileId],
  );
}

export async function markGroupRead(profileId: string, groupId: number): Promise<void> {
  parseProfileId(profileId);
  await assertMember(groupId, profileId);
  await pool.query(
    `insert into group_reads (profile_id, group_id, read_at)
     values ($1, $2, now())
     on conflict (profile_id, group_id) do update set read_at = now()`,
    [profileId, groupId],
  );
}

export async function updateGroupAvatar(profileId: string, groupId: number, avatarUrl: string): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  if (!avatarUrl) throw new ValidationError("URL do avatar inválida.");
  if (avatarUrl.startsWith("data:image/")) {
    if (avatarUrl.length > 9_400_000) throw new ValidationError("Imagem muito grande (máx. ~7 MB).");
  } else if (avatarUrl.length > 2000) {
    throw new ValidationError("URL do avatar inválida.");
  }
  const actor = await resolveMember(groupId, profileId);
  if (!actor || !canEditGroupSettings(actor.role)) {
    throw new ForbiddenError("Só o dono do grupo pode alterar o avatar.");
  }
  const result = await pool.query(`update groups set avatar_url = $2 where id = $1`, [groupId, avatarUrl]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Grupo não encontrado.");
}

export async function updateGroupDetails(
  profileId: string,
  groupId: number,
  updates: { name?: string; description?: string; isPublic?: boolean; avatarEmoji?: string }
): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  
  const actor = await resolveMember(groupId, profileId);
  if (!actor || !canEditGroupSettings(actor.role)) {
    throw new ForbiddenError("Só o dono do grupo pode alterar os detalhes.");
  }

  const setClauses: string[] = [];
  const params: unknown[] = [groupId];
  let paramIndex = 2;

  if (updates.name !== undefined) {
    const name = parseTitle(updates.name, "Nome do grupo");
    setClauses.push(`name = $${paramIndex}`);
    params.push(name);
    paramIndex++;
  }

  if (updates.description !== undefined) {
    const description = updates.description?.trim() || null;
    setClauses.push(`description = $${paramIndex}`);
    params.push(description);
    paramIndex++;
  }

  if (updates.isPublic !== undefined) {
    setClauses.push(`is_public = $${paramIndex}`);
    params.push(updates.isPublic);
    paramIndex++;
  }

  if (updates.avatarEmoji !== undefined) {
    setClauses.push(`avatar_emoji = $${paramIndex}`);
    params.push(updates.avatarEmoji);
    paramIndex++;
    // Choosing an emoji as the icon supersedes any uploaded image, otherwise
    // the old avatar_url would keep rendering over the emoji.
    setClauses.push(`avatar_url = NULL`);
  }

  if (setClauses.length === 0) return;

  const query = `update groups set ${setClauses.join(", ")} where id = $1`;
  const result = await pool.query(query, params);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Grupo não encontrado.");
}

export async function inviteToGroup(profileId: string, groupId: number, inviteIds: string[]): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  
  const owner = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2 and role in ('OWNER', 'ADMIN')`,
    [groupId, profileId],
  );
  if (!owner.rows[0]) throw new ForbiddenError("Só dono ou administrador do grupo pode convidar membros.");

  const uniqueIds = [...new Set(inviteIds.map((id) => parseProfileId(id)))].filter((id) => id !== profileId);
  
  for (const id of uniqueIds) {
    if (!(await areFriends(profileId, id))) {
      throw new ForbiddenError("Você só pode convidar amigos para o grupo.");
    }
  }

  for (const id of uniqueIds) {
    await pool.query(
      `insert into group_members (group_id, profile_id, role) values ($1, $2, 'MEMBER')
       on conflict do nothing`,
      [groupId, id],
    );
  }
}

export async function leaveGroup(profileId: string, groupId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  
  const member = await pool.query<{ role: string }>(
    `select role from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
  if (!member.rows[0]) throw new NotFoundError("Você não faz parte deste grupo.");
  
  if (member.rows[0].role === 'OWNER') {
    throw new ValidationError("O dono do grupo não pode sair. Transfira a propriedade primeiro.");
  }

  await pool.query(
    `delete from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
}

/**
 * Get a member's role in a group (null if not a member).
 */
export async function getMemberRole(profileId: string, groupId: number): Promise<GroupRole | null> {
  parseProfileId(profileId);
  const result = await pool.query<{ role: string }>(
    `select role from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
  const role = result.rows[0]?.role as GroupRole | undefined;
  return role ?? null;
}

const ROLE_RANK: Record<GroupRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

/** Change a member's role (promote to admin / demote to member / transfer). */
export async function updateMemberRole(
  profileId: string,
  groupId: number,
  targetProfileId: string,
  newRole: GroupRole,
): Promise<void> {
  parseProfileId(profileId);
  parseProfileId(targetProfileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  if (!Object.prototype.hasOwnProperty.call(ROLE_RANK, newRole)) throw new ValidationError("Função inválida.");

  const actorRole = await getMemberRole(profileId, groupId);
  if (!actorRole) throw new ForbiddenError("Você não faz parte deste grupo.");
  if (actorRole !== 'OWNER') throw new ForbiddenError("Só o dono do grupo pode promover ou rebaixar membros.");

  if (targetProfileId === profileId) throw new ValidationError("Você não pode alterar sua própria função.");

  const targetRole = await getMemberRole(targetProfileId, groupId);
  if (!targetRole) throw new NotFoundError("Membro não encontrado.");

  const targetRank = ROLE_RANK[targetRole];
  const requestedRank = ROLE_RANK[newRole];
  if (targetRank === 3) throw new ValidationError("O dono não pode ter a função alterada.");
  if (newRole === 'OWNER') throw new ValidationError("Conceda a propriedade usando a transferência.");
  if (requestedRank > ROLE_RANK.OWNER) throw new ValidationError("Você não pode conceder a propriedade a outro membro.");

  await pool.query(
    `update group_members set role = $1 where group_id = $2 and profile_id = $3`,
    [newRole, groupId, targetProfileId],
  );
}

/** Remove a member from the group (owner/admin can remove members/admins). */
export async function removeMember(
  profileId: string,
  groupId: number,
  targetProfileId: string,
): Promise<void> {
  parseProfileId(profileId);
  parseProfileId(targetProfileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");

  const actorRole = await getMemberRole(profileId, groupId);
  if (!actorRole) throw new ForbiddenError("Você não faz parte deste grupo.");
  if (targetProfileId === profileId) throw new ValidationError("Para sair, use a opção de sair do grupo.");

  const targetRole = await getMemberRole(targetProfileId, groupId);
  if (!targetRole) throw new NotFoundError("Membro não encontrado.");
  if (targetRole === 'OWNER') throw new ValidationError("Não é possível remover o dono do grupo.");

  if (!canKick(actorRole, profileId, targetProfileId, targetRole)) {
    throw new ForbiddenError("Só o dono do grupo pode remover membros.");
  }

  await pool.query(
    `delete from group_members where group_id = $1 and profile_id = $2`,
    [groupId, targetProfileId],
  );
}

/** Transfer group ownership to another member (owner only). */
export async function transferOwnership(profileId: string, groupId: number, targetProfileId: string): Promise<void> {
  parseProfileId(profileId);
  parseProfileId(targetProfileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");

  const actorRole = await getMemberRole(profileId, groupId);
  if (actorRole !== 'OWNER') throw new ForbiddenError("Só o dono do grupo pode transferir a propriedade.");
  if (targetProfileId === profileId) throw new ValidationError("Você já é o dono do grupo.");

  const targetRole = await getMemberRole(targetProfileId, groupId);
  if (!targetRole) throw new NotFoundError("Membro não encontrado.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update group_members set role = 'OWNER' where group_id = $1 and profile_id = $2`,
      [groupId, targetProfileId],
    );
    await client.query(
      `update group_members set role = 'ADMIN' where group_id = $1 and profile_id = $2 and role = 'OWNER'`,
      [groupId, profileId],
    );
    await client.query(`update groups set created_by = $2 where id = $1`, [groupId, targetProfileId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Delete a group entirely (owner only). Cascades to members/messages/read-state. */
export async function deleteGroup(profileId: string, groupId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");

  const actorRole = await getMemberRole(profileId, groupId);
  if (!actorRole) throw new ForbiddenError("Você não faz parte deste grupo.");
  if (actorRole !== 'OWNER') throw new ForbiddenError("Só o dono do grupo pode excluí-lo.");

  const result = await pool.query(`delete from groups where id = $1`, [groupId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Grupo não encontrado.");
}



export function parseGroupId(value: unknown): number {
  return parseNumber(value, "Grupo", { integer: true, min: 1 });
}

const STICKERS: { id: string; emoji: string }[] = [
  { id: "fire", emoji: "🔥" },
  { id: "rocket", emoji: "🚀" },
  { id: "clap", emoji: "👏" },
  { id: "muscle", emoji: "💪" },
  { id: "party", emoji: "🎉" },
  { id: "fist", emoji: "✊" },
  { id: "sparkle", emoji: "✨" },
  { id: "star", emoji: "⭐" },
  { id: "coffee", emoji: "☕" },
  { id: "zzz", emoji: "😴" },
  { id: "tear", emoji: "😂" },
  { id: "heart", emoji: "❤️" },
  { id: "thinking", emoji: "🤔" },
  { id: "check", emoji: "✅" },
  { id: "wow", emoji: "😮" },
  { id: "moon", emoji: "🌙" },
];

export function getAvailableStickers(): { id: string; emoji: string }[] {
  return STICKERS;
}
