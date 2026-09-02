import pool from "../db";
import { NotFoundError } from "../errors";
import { ValidationError, parseProfileId, parseNumber } from "./validation";
import { weekStartIso, todayIso, addDaysIso } from "./dates";

export type Period = "WEEK" | "MONTH" | "YEAR" | "ALL_TIME";

export interface GroupFocusContribution {
  id: number;
  groupId: number;
  profileId: string;
  focusSessionId: number;
  minutes: number;
  contributedAt: string;
}

export interface GroupTotalMinutes {
  groupId: number;
  totalMinutes: number;
}

export interface GroupLeaderboardEntry {
  groupId: number;
  groupName: string;
  groupAvatarEmoji: string;
  groupAvatarUrl?: string;
  memberCount: number;
  totalMinutes: number;
  rank: number;
  isUserGroup: boolean;
  rankChange?: "up" | "down" | "same";
}

export interface MemberContribution {
  profileId: string;
  displayName: string;
  username?: string;
  photoUrl?: string;
  minutes: number;
  percentage: number;
  rank: number;
}

interface ContributionRow {
  id: string | number;
  group_id: string | number;
  profile_id: string;
  focus_session_id: string | number;
  minutes: string | number;
  contributed_at: Date | string;
}

function mapContribution(row: ContributionRow): GroupFocusContribution {
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    profileId: row.profile_id,
    focusSessionId: Number(row.focus_session_id),
    minutes: Number(row.minutes),
    contributedAt: typeof row.contributed_at === "string" ? row.contributed_at : row.contributed_at.toISOString(),
  };
}

/**
 * Get date range for a given period
 */
export function getPeriodRange(period: Period): { start: string | null; end: string | null } {
  const today = todayIso();
  
  switch (period) {
    case "WEEK":
      const weekStart = weekStartIso(today);
      return { start: weekStart, end: addDaysIso(weekStart, 7) };
    case "MONTH":
      const monthStart = today.slice(0, 7) + "-01";
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return { start: monthStart, end: nextMonth.toISOString().slice(0, 10) };
    case "YEAR":
      const yearStart = today.slice(0, 4) + "-01-01";
      const nextYear = new Date(yearStart);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return { start: yearStart, end: nextYear.toISOString().slice(0, 10) };
    case "ALL_TIME":
      return { start: null, end: null };
    default:
      // Return default for invalid periods to avoid errors in shared functions
      return { start: null, end: null };
  }
}

/**
 * Record a focus session contribution to all groups the user belongs to
 */
export async function recordGroupContribution(
  profileId: string,
  focusSessionId: number,
  minutes: number,
  completedAt: string
): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(focusSessionId) || focusSessionId <= 0) {
    throw new ValidationError("Sessão de foco inválida.");
  }
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new ValidationError("Minutos inválidos.");
  }

  // Get all groups the user belongs to
  const groups = await pool.query<{ group_id: string | number }>(
    `select group_id from group_members where profile_id = $1`,
    [profileId]
  );

  if (groups.rows.length === 0) return;

  // Insert a contribution for each group
  const values: unknown[] = [];
  const placeholders: string[] = [];
  
  for (const row of groups.rows) {
    placeholders.push(`($${values.length + 1}, $${values.length + 2}, $${values.length + 3}, $${values.length + 4}, $${values.length + 5})`);
    values.push(row.group_id, profileId, focusSessionId, minutes, completedAt);
  }

  await pool.query(
    `insert into group_focus_contributions (group_id, profile_id, focus_session_id, minutes, contributed_at)
     values ${placeholders.join(", ")}
     on conflict (group_id, profile_id, focus_session_id) do nothing`,
    values
  );
}

/**
 * Get total focus minutes for a specific group within a period
 */
export async function getGroupTotalMinutes(groupId: number, period: Period): Promise<number> {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new ValidationError("Grupo inválido.");
  }

  const { start, end } = getPeriodRange(period);
  
  let query = `select coalesce(sum(minutes), 0)::int as total from group_focus_contributions where group_id = $1`;
  const params: unknown[] = [groupId];

  if (start && end) {
    query += ` and contributed_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'`;
    query += ` and contributed_at < (($3::date))::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start, end);
  }

  const result = await pool.query<{ total: string }>(query, params);
  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Get global group leaderboard for a given period
 */
export async function getGlobalGroupLeaderboard(
  profileId: string,
  period: Period,
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: GroupLeaderboardEntry[]; userGroupIds: number[] }> {
  parseProfileId(profileId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError("Limite inválido.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError("Offset inválido.");
  }

  const { start, end } = getPeriodRange(period);
  
  // Get user's group IDs for highlighting
  const userGroups = await pool.query<{ group_id: string | number }>(
    `select group_id from group_members where profile_id = $1`,
    [profileId]
  );
  const userGroupIds = userGroups.rows.map(row => Number(row.group_id));

  // Build the main query with period filtering
  // Include the user's own groups even when they are private, so their groups
  // always appear in the leaderboard. Other users can only see public groups.
  let visibilityClause = "and (g.is_public = true or g.id = any($1::bigint[]))";
  const params: unknown[] = [userGroupIds.length > 0 ? userGroupIds : [-1]];
  let paramIndex = 2;

  if (start && end) {
    visibilityClause += ` and gfc.contributed_at >= ($${paramIndex}::date)::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start);
    paramIndex++;
    visibilityClause += ` and gfc.contributed_at < (($${paramIndex}::date))::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(end);
    paramIndex++;
  }

  const result = await pool.query<{
    group_id: string | number;
    name: string;
    avatar_emoji: string;
    avatar_url: string | null;
    member_count: string | number;
    total_minutes: string | number;
  }>(
    `select g.id as group_id, g.name, g.avatar_emoji, g.avatar_url,
            (select count(*) from group_members gm where gm.group_id = g.id) as member_count,
            coalesce(sum(gfc.minutes), 0)::int as total_minutes
     from groups g
     left join group_focus_contributions gfc on gfc.group_id = g.id
     where 1 = 1
     ${visibilityClause}
     group by g.id, g.name, g.avatar_emoji, g.avatar_url
     having coalesce(sum(gfc.minutes), 0) > 0
     order by total_minutes desc
     limit $${paramIndex} offset $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const entries: GroupLeaderboardEntry[] = result.rows.map((row, index) => ({
    groupId: Number(row.group_id),
    groupName: row.name,
    groupAvatarEmoji: row.avatar_emoji,
    groupAvatarUrl: row.avatar_url ?? undefined,
    memberCount: Number(row.member_count),
    totalMinutes: Number(row.total_minutes),
    rank: offset + index + 1,
    isUserGroup: userGroupIds.includes(Number(row.group_id)),
  }));

  return { entries, userGroupIds };
}

/**
 * Get member contributions for a specific group within a period
 */
export async function getGroupMemberContributions(
  profileId: string,
  groupId: number,
  period: Period
): Promise<{ members: MemberContribution[]; groupTotal: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new ValidationError("Grupo inválido.");
  }

  // Verify user is a member
  const memberCheck = await pool.query(
    `select 1 from group_members where group_id = $1 and profile_id = $2`,
    [groupId, profileId]
  );
  if (!memberCheck.rows[0]) {
    throw new NotFoundError("Você não faz parte deste grupo.");
  }

  const { start, end } = getPeriodRange(period);
  
  let query = `
    select p.id as profile_id, p.display_name, p.username, p.photo_url,
           coalesce(sum(gfc.minutes), 0)::int as minutes
    from group_members gm
    join profiles p on p.id = gm.profile_id
    left join group_focus_contributions gfc on gfc.group_id = gm.group_id and gfc.profile_id = p.id
    where gm.group_id = $1
  `;
  const params: unknown[] = [groupId];

  if (start && end) {
    query += ` and gfc.contributed_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'`;
    query += ` and gfc.contributed_at < (($3::date))::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start, end);
  }

  query += ` group by p.id, p.display_name, p.username, p.photo_url
             order by minutes desc`;

  const result = await pool.query<{
    profile_id: string;
    display_name: string;
    username: string | null;
    photo_url: string | null;
    minutes: string | number;
  }>(query, params);

  const groupTotal = result.rows.reduce((sum, row) => sum + Number(row.minutes), 0);

  const members: MemberContribution[] = result.rows.map((row, index) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    username: row.username ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    minutes: Number(row.minutes),
    percentage: groupTotal > 0 ? (Number(row.minutes) / groupTotal) * 100 : 0,
    rank: index + 1,
  }));

  return { members, groupTotal };
}

/**
 * Get contribution history for a user across their groups
 */
export async function getUserGroupContributions(
  profileId: string,
  limit: number = 20
): Promise<GroupFocusContribution[]> {
  parseProfileId(profileId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError("Limite inválido.");
  }

  const result = await pool.query<ContributionRow>(
    `select id, group_id, profile_id, focus_session_id, minutes, contributed_at
     from group_focus_contributions
     where profile_id = $1
     order by contributed_at desc
     limit $2`,
    [profileId, limit]
  );

  return result.rows.map(mapContribution);
}

/**
 * Get user's contribution percentage to a specific group
 */
export async function getUserGroupContributionPercentage(
  profileId: string,
  groupId: number,
  period: Period
): Promise<{ userMinutes: number; groupTotal: number; percentage: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new ValidationError("Grupo inválido.");
  }

  const { start, end } = getPeriodRange(period);
  
  let query = `
    select 
      coalesce(sum(case when profile_id = $1 then minutes else 0 end), 0)::int as user_minutes,
      coalesce(sum(minutes), 0)::int as group_total
    from group_focus_contributions
    where group_id = $2
  `;
  const params: unknown[] = [profileId, groupId];

  if (start && end) {
    query += ` and contributed_at >= ($3::date)::timestamp at time zone 'America/Sao_Paulo'`;
    query += ` and contributed_at < (($4::date))::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start, end);
  }

  const result = await pool.query<{
    user_minutes: string | number;
    group_total: string | number;
  }>(query, params);

  const userMinutes = Number(result.rows[0]?.user_minutes ?? 0);
  const groupTotal = Number(result.rows[0]?.group_total ?? 0);
  const percentage = groupTotal > 0 ? (userMinutes / groupTotal) * 100 : 0;

  return { userMinutes, groupTotal, percentage };
}

/**
 * Get group's global rank and total groups for a period
 */
export async function getGroupGlobalRank(groupId: number, period: Period): Promise<{ rank: number; totalGroups: number }> {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new ValidationError("Grupo inválido.");
  }
  
  const { start, end } = getPeriodRange(period);
  
  // A group's rank is always visible to its own members, so always include the
  // group being ranked even if it is private. Private groups owned by other
  // users are not part of the ranking universe.
  let visibilityClause = "and (g.is_public = true or g.id = $1::bigint)";
  const params: unknown[] = [groupId];
  let paramIndex = 2;

  if (start && end) {
    visibilityClause += ` and gfc.contributed_at >= ($${paramIndex}::date)::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start);
    paramIndex++;
    visibilityClause += ` and gfc.contributed_at < (($${paramIndex}::date))::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(end);
    paramIndex++;
  }

  // Get the rank and total count in a single query
  const result = await pool.query<{
    rank: string | number;
    total: string | number;
  }>(
    `with ranked_groups as (
      select g.id,
             coalesce(sum(gfc.minutes), 0)::int as total_minutes,
             rank() over (order by coalesce(sum(gfc.minutes), 0) desc) as group_rank
      from groups g
      left join group_focus_contributions gfc on gfc.group_id = g.id
      where 1 = 1
      ${visibilityClause}
      group by g.id
      having coalesce(sum(gfc.minutes), 0) > 0
    )
    select 
      (select group_rank from ranked_groups where id = $${paramIndex}) as rank,
      (select count(*) from ranked_groups) as total`,
    [...params, groupId]
  );

  const rank = result.rows[0]?.rank ? Number(result.rows[0].rank) : null;
  const total = Number(result.rows[0]?.total ?? 0);

  if (rank === null) {
    return { rank: 0, totalGroups: total };
  }

  return { rank, totalGroups: total };
}