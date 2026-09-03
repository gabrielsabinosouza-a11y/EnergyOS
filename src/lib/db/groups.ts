import pool from "../db";
import type { GroupDetail, GroupMember, GroupMessage, GroupRole, GroupSummary, LeagueEntry } from "@/types";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseNumber, parseProfileId, parseTitle, ValidationError } from "./validation";
import { areFriends } from "./social";
import { getWeeklyFocusMinutesForProfiles } from "./focus";
import { sundayWeekStartIso, todayIso } from "./dates";
import { xpFromMinutes } from "./league";
import { getGroupTotalMinutes, getGroupMemberContributions, getGroupGlobalRank, getPeriodRange, type Period } from "./group-leaderboard";

const GROUP_EMOJIS = new Set(["⚡", "🔥", "✨", "💎", "🌙", "☀️", "🌊", "🌿", "🎯", "💜", "🌀", "⭐", "🚀", "🧠"]);

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
      current_streak: number | null;
    }
  >(
    `select p.id, p.display_name, p.username, p.photo_url, m.role, m.is_muted, p.current_streak
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
  };
  const selectColumns = `gm.id, gm.group_id, gm.sender_id, gm.body, gm.message_type,
     gm.media_url, gm.media_duration_seconds, gm.created_at, gm.reply_to_id, gm.edited_at,
     rp.body as reply_to_body, rp.sender_id as reply_sender_id, rpname.display_name as reply_to_sender_name,
     p.display_name, p.photo_url`;

  const result = afterId
    ? await pool.query<MsgRow>(
        `select ${selectColumns}
         from group_messages gm
         join profiles p on p.id = gm.sender_id
         left join group_messages rp on rp.id = gm.reply_to_id
         left join profiles rpname on rpname.id = rp.sender_id
         where gm.group_id = $1 and gm.id > $2
         order by gm.created_at asc
         limit 100`,
        [groupId, afterId],
      )
    : await pool.query<MsgRow>(
        `select ${selectColumns}
         from group_messages gm
         join profiles p on p.id = gm.sender_id
         left join group_messages rp on rp.id = gm.reply_to_id
         left join profiles rpname on rpname.id = rp.sender_id
         where gm.group_id = $1
         order by gm.created_at desc
         limit 80`,
        [groupId],
      );

  const rows = afterId ? result.rows : [...result.rows].reverse();
  return rows.map((row) => ({
    id: Number(row.id),
    groupId: Number(row.group_id),
    senderId: row.sender_id,
    senderName: row.display_name,
    senderPhotoUrl: row.photo_url ?? undefined,
    body: row.body ?? undefined,
    messageType: (row.message_type as GroupMessage["messageType"]) || "TEXT",
    mediaUrl: row.media_url ?? undefined,
    mediaDurationSeconds: row.media_duration_seconds != null ? Number(row.media_duration_seconds) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    replyToId: row.reply_to_id != null ? Number(row.reply_to_id) : undefined,
    replyToBody: row.reply_to_body ?? undefined,
    replyToSenderName: row.reply_to_sender_name ?? undefined,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
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
  const membership = await pool.query<{ is_muted: boolean }>(
    `select is_muted from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
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
    `insert into group_messages (group_id, sender_id, body, message_type, media_url, media_duration_seconds, reply_to_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, group_id, sender_id, body, message_type, media_url, media_duration_seconds, created_at, reply_to_id, edited_at`,
    [groupId, profileId, text, messageType, mediaUrl, mediaDurationSeconds, opts?.replyToId ?? null],
  );
  const row = inserted.rows[0];
  const sender = await pool.query<{ display_name: string; photo_url: string | null }>(
    `select display_name, photo_url from profiles where id = $1`,
    [profileId],
  );
  // Fetch reply join info
  let replyToBody: string | undefined;
  let replyToSenderName: string | undefined;
  if (row.reply_to_id != null) {
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
  const result = await pool.query(
    `delete from group_messages
     where id = $1 and group_id = $2 and sender_id = $3`,
    [messageId, groupId, profileId],
  );
  if (result.rowCount === 0) throw new NotFoundError("Mensagem não encontrada.");
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
  const owner = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2 and role in ('OWNER', 'ADMIN')`,
    [groupId, profileId],
  );
  if (!owner.rows[0]) throw new ForbiddenError("Só dono ou administrador do grupo pode alterar o avatar.");
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
  
  const owner = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2 and role in ('OWNER', 'ADMIN')`,
    [groupId, profileId],
  );
  if (!owner.rows[0]) throw new ForbiddenError("Só dono ou administrador do grupo pode alterar os detalhes.");

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
  if (!['OWNER', 'ADMIN'].includes(actorRole)) throw new ForbiddenError("Só dono ou administrador do grupo pode alterar funções.");

  if (targetProfileId === profileId) throw new ValidationError("Você não pode alterar sua própria função.");

  const targetRole = await getMemberRole(targetProfileId, groupId);
  if (!targetRole) throw new NotFoundError("Membro não encontrado.");

  const actorRank = ROLE_RANK[actorRole];
  const targetRank = ROLE_RANK[targetRole];
  const requestedRank = ROLE_RANK[newRole];
  if (targetRank === 3) throw new ValidationError("O dono não pode ter a função alterada.");
  if (newRole === 'OWNER') throw new ValidationError("Conceda a propriedade usando a transferência.");
  if (requestedRank > actorRank) throw new ValidationError("Você não pode conceder uma função superior à sua.");
  if (requestedRank === 3) throw new ValidationError("Você não pode conceder a propriedade a outro membro.");

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

  if (actorRole === 'OWNER') {
    // Owner can remove admins and members.
  } else if (actorRole === 'ADMIN' && (targetRole === 'MEMBER' || targetRole === 'ADMIN')) {
    // Admin can remove members and other admins (but not the owner).
  } else {
    throw new ForbiddenError("Você não tem permissão para remover membros.");
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
