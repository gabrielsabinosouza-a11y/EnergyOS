import pool from "../db";
import type { GroupDetail, GroupMember, GroupMessage, GroupSummary, LeagueEntry } from "@/types";
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
  input: { name: string; avatarEmoji?: string; description?: string; isPublic?: boolean; inviteIds?: string[] },
): Promise<GroupDetail> {
  parseProfileId(profileId);
  const name = parseTitle(input.name, "Nome do grupo");
  const emoji = input.avatarEmoji?.trim() || "⚡";
  if (!GROUP_EMOJIS.has(emoji)) throw new ValidationError("Escolha um emoji da lista.");
  
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
      `insert into groups (name, avatar_emoji, description, is_public, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, name, avatar_emoji, avatar_url, created_by, created_at, description, is_public`,
      [name, emoji, description, isPublic, profileId],
    );
    const group = created.rows[0];
    await client.query(
      `insert into group_members (group_id, profile_id, role) values ($1, $2, 'owner')`,
      [group.id, profileId],
    );
    for (const id of inviteIds) {
      await client.query(
        `insert into group_members (group_id, profile_id, role) values ($1, $2, 'member')
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
      role: "owner" | "member";
      current_streak: number | null;
    }
  >(
    `select p.id, p.display_name, p.username, p.photo_url, m.role, p.current_streak
     from group_members m
     join profiles p on p.id = m.profile_id
     where m.group_id = $1
     order by m.role desc, p.display_name asc`,
    [groupId],
  );

  // Get period-scoped focus minutes using the new leaderboard system
  const periodMinutes = await getGroupTotalMinutes(groupId, period);

  const mapped: GroupMember[] = members.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    role: row.role,
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

  const result = afterId
    ? await pool.query<{
        id: string | number;
        group_id: string | number;
        sender_id: string;
        body: string;
        created_at: Date | string;
        display_name: string;
        photo_url: string | null;
      }>(
        `select gm.id, gm.group_id, gm.sender_id, gm.body, gm.created_at, p.display_name, p.photo_url
         from group_messages gm
         join profiles p on p.id = gm.sender_id
         where gm.group_id = $1 and gm.id > $2
         order by gm.created_at asc
         limit 100`,
        [groupId, afterId],
      )
    : await pool.query<{
        id: string | number;
        group_id: string | number;
        sender_id: string;
        body: string;
        created_at: Date | string;
        display_name: string;
        photo_url: string | null;
      }>(
        `select gm.id, gm.group_id, gm.sender_id, gm.body, gm.created_at, p.display_name, p.photo_url
         from group_messages gm
         join profiles p on p.id = gm.sender_id
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
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function sendGroupMessage(profileId: string, groupId: number, body: string): Promise<GroupMessage> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  await assertMember(groupId, profileId);
  const text = parseTitle(body, "Mensagem");
  if (text.length > 2000) throw new ValidationError("Mensagem deve ter no máximo 2000 caracteres.");

  const inserted = await pool.query<{
    id: string | number;
    group_id: string | number;
    sender_id: string;
    body: string;
    created_at: Date | string;
  }>(
    `insert into group_messages (group_id, sender_id, body)
     values ($1, $2, $3)
     returning id, group_id, sender_id, body, created_at`,
    [groupId, profileId, text],
  );
  const row = inserted.rows[0];
  const sender = await pool.query<{ display_name: string; photo_url: string | null }>(
    `select display_name, photo_url from profiles where id = $1`,
    [profileId],
  );
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    senderId: row.sender_id,
    senderName: sender.rows[0]?.display_name ?? "Você",
    senderPhotoUrl: sender.rows[0]?.photo_url ?? undefined,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
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
  if (!avatarUrl || avatarUrl.length > 2000) throw new ValidationError("URL do avatar inválida.");
  const owner = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2 and role = 'owner'`,
    [groupId, profileId],
  );
  if (!owner.rows[0]) throw new ForbiddenError("Só o dono do grupo pode alterar o avatar.");
  const result = await pool.query(`update groups set avatar_url = $2 where id = $1`, [groupId, avatarUrl]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Grupo não encontrado.");
}

export async function updateGroupDetails(
  profileId: string,
  groupId: number,
  updates: { name?: string; description?: string; isPublic?: boolean }
): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  
  const owner = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2 and role = 'owner'`,
    [groupId, profileId],
  );
  if (!owner.rows[0]) throw new ForbiddenError("Só o dono do grupo pode alterar os detalhes.");

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

  if (setClauses.length === 0) return;

  const query = `update groups set ${setClauses.join(", ")} where id = $1`;
  const result = await pool.query(query, params);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Grupo não encontrado.");
}

export async function inviteToGroup(profileId: string, groupId: number, inviteIds: string[]): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) throw new ValidationError("Grupo inválido.");
  
  const owner = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2 and role = 'owner'`,
    [groupId, profileId],
  );
  if (!owner.rows[0]) throw new ForbiddenError("Só o dono do grupo pode convidar membros.");

  const uniqueIds = [...new Set(inviteIds.map((id) => parseProfileId(id)))].filter((id) => id !== profileId);
  
  for (const id of uniqueIds) {
    if (!(await areFriends(profileId, id))) {
      throw new ForbiddenError("Você só pode convidar amigos para o grupo.");
    }
  }

  for (const id of uniqueIds) {
    await pool.query(
      `insert into group_members (group_id, profile_id, role) values ($1, $2, 'member')
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
  
  if (member.rows[0].role === 'owner') {
    throw new ValidationError("O dono do grupo não pode sair. Transfira a propriedade primeiro.");
  }

  await pool.query(
    `delete from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
}



export function parseGroupId(value: unknown): number {
  return parseNumber(value, "Grupo", { integer: true, min: 1 });
}
