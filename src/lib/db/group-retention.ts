import pool from "../db";
import { NotFoundError } from "../errors";
import { parseProfileId } from "./validation";
import { getGroupTotalMinutes, getGroupGlobalRank, getPeriodRange, type Period } from "./group-leaderboard";
import { acceptedFriendIds } from "./social";

/**
 * Milestone thresholds for group combined focus hours
 */
const MILESTONE_HOURS = [100, 500, 1000, 2500, 5000, 10000];

/**
 * Check if group crossed a milestone and trigger celebration
 */
export async function checkGroupMilestone(groupId: number): Promise<{ crossed: boolean; milestoneHours: number | null }> {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new NotFoundError("Grupo inválido.");
  }

  const allTimeMinutes = await getGroupTotalMinutes(groupId, "ALL_TIME");
  const allTimeHours = Math.floor(allTimeMinutes / 60);

  // Check if we just crossed a milestone
  for (const milestone of MILESTONE_HOURS) {
    if (allTimeHours === milestone) {
      // Get all group members to notify
      const members = await pool.query<{ profile_id: string }>(
        `select profile_id from group_members where group_id = $1`,
        [groupId]
      );

      // In a real implementation, this would trigger notifications
      // For now, we'll return the milestone info
      return { crossed: true, milestoneHours: milestone };
    }
  }

  return { crossed: false, milestoneHours: null };
}

/**
 * Check proximity to next ranked group (within 30 minutes)
 */
export async function checkGroupProximity(groupId: number, period: Period = "WEEK"): Promise<{
  isClose: boolean;
  minutesBehind: number;
  aheadGroupName: string | null;
  aheadGroupId: number | null;
}> {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new NotFoundError("Grupo inválido.");
  }

  const groupMinutes = await getGroupTotalMinutes(groupId, period);
  const { rank } = await getGroupGlobalRank(groupId, period);

  if (rank <= 1) {
    // Group is #1, no one ahead
    return { isClose: false, minutesBehind: 0, aheadGroupName: null, aheadGroupId: null };
  }

  const { start, end } = getPeriodRange(period);
  
  let whereClause = "where g.is_public = true";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (start && end) {
    whereClause += ` and gfc.contributed_at >= ($${paramIndex}::date)::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start);
    paramIndex++;
    whereClause += ` and gfc.contributed_at < (($${paramIndex}::date))::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(end);
    paramIndex++;
  }

  // Get the group ranked directly above
  const result = await pool.query<{
    group_id: string | number;
    name: string;
    total_minutes: string | number;
  }>(
    `with ranked_groups as (
      select g.id, g.name,
             coalesce(sum(gfc.minutes), 0)::int as total_minutes,
             rank() over (order by coalesce(sum(gfc.minutes), 0) desc) as group_rank
      from groups g
      left join group_focus_contributions gfc on gfc.group_id = g.id
      ${whereClause}
      group by g.id, g.name
      having coalesce(sum(gfc.minutes), 0) > 0
    )
    select group_id, name, total_minutes
    from ranked_groups
    where group_rank = $${paramIndex}
    limit 1`,
    [...params, rank - 1]
  );

  if (!result.rows[0]) {
    return { isClose: false, minutesBehind: 0, aheadGroupName: null, aheadGroupId: null };
  }

  const aheadGroup = result.rows[0];
  const minutesBehind = Number(aheadGroup.total_minutes) - groupMinutes;
  const isClose = minutesBehind > 0 && minutesBehind <= 30;

  return {
    isClose,
    minutesBehind,
    aheadGroupName: aheadGroup.name,
    aheadGroupId: Number(aheadGroup.group_id),
  };
}



/**
 * Generate weekly reset summary for a group
 */
export async function generateWeeklyResetSummary(groupId: number): Promise<{
  groupId: number;
  finalRank: number;
  totalGroups: number;
  totalMinutes: number;
  memberCount: number;
  topContributor: { displayName: string; minutes: number } | null;
}> {
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new NotFoundError("Grupo inválido.");
  }

  const { rank, totalGroups: total } = await getGroupGlobalRank(groupId, "WEEK");
  const totalMinutes = await getGroupTotalMinutes(groupId, "WEEK");
  
  const members = await pool.query<{ count: string }>(
    `select count(*)::int as count from group_members where group_id = $1`,
    [groupId]
  );

  // Get member contributions for the week
  const { start, end } = getPeriodRange("WEEK");
  let memberQuery = `
    select p.display_name, coalesce(sum(gfc.minutes), 0)::int as minutes
    from group_members gm
    join profiles p on p.id = gm.profile_id
    left join group_focus_contributions gfc on gfc.group_id = gm.group_id and gfc.profile_id = p.id
    where gm.group_id = $1
  `;
  const memberParams: unknown[] = [groupId];

  if (start && end) {
    memberQuery += ` and gfc.contributed_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'`;
    memberQuery += ` and gfc.contributed_at < (($3::date))::timestamp at time zone 'America/Sao_Paulo'`;
    memberParams.push(start, end);
  }

  memberQuery += ` group by p.display_name order by minutes desc limit 1`;

  const memberResult = await pool.query<{ display_name: string; minutes: string | number }>(
    memberQuery, memberParams
  );

  const topContributor = memberResult.rows[0] 
    ? { displayName: memberResult.rows[0].display_name, minutes: Number(memberResult.rows[0].minutes) }
    : null;

  return {
    groupId,
    finalRank: rank,
    totalGroups: total,
    totalMinutes,
    memberCount: Number(members.rows[0]?.count ?? 0),
    topContributor,
  };
}

/**
 * Get empty state recommendations for a new group
 */
export async function getGroupEmptyStateRecommendations(profileId: string, groupId: number): Promise<{
  recommendedInviteCount: number;
  friendIds: string[];
  message: string;
}> {
  parseProfileId(profileId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new NotFoundError("Grupo inválido.");
  }

  // Get current member count
  const memberCount = await pool.query<{ count: string }>(
    `select count(*)::int as count from group_members where group_id = $1`,
    [groupId]
  );

  const currentCount = Number(memberCount.rows[0]?.count ?? 0);
  
  // Recommend inviting 2-3 friends if group has only 1 member
  if (currentCount > 1) {
    return {
      recommendedInviteCount: 0,
      friendIds: [],
      message: "Seu grupo já está pronto para começar!",
    };
  }

  // Get user's friends who aren't in the group yet
  const friendIds = await acceptedFriendIds(profileId);
  const existingMembers = await pool.query<{ profile_id: string }>(
    `select profile_id from group_members where group_id = $1`,
    [groupId]
  );
  const existingMemberIds = new Set(existingMembers.rows.map(r => r.profile_id));
  
  const availableFriends = friendIds.filter(id => !existingMemberIds.has(id));
  
  return {
    recommendedInviteCount: Math.min(3, availableFriends.length),
    friendIds: availableFriends.slice(0, 3),
    message: "Convide pelo menos 2-3 amigos para começar a competir!",
  };
}

/**
 * Get retention-optimized leaderboard (scoped to user's groups + friends' groups)
 */
export async function getScopedGroupLeaderboard(
  profileId: string,
  period: Period = "WEEK",
  limit: number = 50
): Promise<{
  entries: Array<{
    groupId: number;
    groupName: string;
    groupAvatarEmoji: string;
    groupAvatarUrl?: string;
    memberCount: number;
    totalMinutes: number;
    rank: number;
    isUserGroup: boolean;
    isFriendGroup: boolean;
  }>;
  userGroupIds: number[];
}> {
  parseProfileId(profileId);
  
  // Get user's groups
  const userGroups = await pool.query<{ group_id: string | number }>(
    `select group_id from group_members where profile_id = $1`,
    [profileId]
  );
  const userGroupIds = userGroups.rows.map(row => Number(row.group_id));

  // Get friends' group IDs
  const friendIds = await acceptedFriendIds(profileId);
  const friendGroupIds = friendIds.length > 0 
    ? await pool.query<{ group_id: string | number }>(
        `select distinct group_id from group_members where profile_id = any($1::text[])`,
        [friendIds]
      )
    : { rows: [] as Array<{ group_id: string | number }> };
  
  const friendGroupIdSet = new Set(friendGroupIds.rows.map(row => Number(row.group_id)));
  const allRelevantGroupIds = new Set([...userGroupIds, ...friendGroupIdSet]);

  if (allRelevantGroupIds.size === 0) {
    return { entries: [], userGroupIds };
  }

  const { start, end } = getPeriodRange(period);
  
  let whereClause = `where g.id = any($1::int[])`;
  const params: unknown[] = [Array.from(allRelevantGroupIds)];
  let paramIndex = 2;

  if (start && end) {
    whereClause += ` and gfc.contributed_at >= ($${paramIndex}::date)::timestamp at time zone 'America/Sao_Paulo'`;
    params.push(start);
    paramIndex++;
    whereClause += ` and gfc.contributed_at < (($${paramIndex}::date))::timestamp at time zone 'America/Sao_Paulo'`;
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
     ${whereClause}
     group by g.id, g.name, g.avatar_emoji, g.avatar_url
     having coalesce(sum(gfc.minutes), 0) > 0
     order by total_minutes desc
     limit $${paramIndex}`,
    [...params, limit]
  );

  const entries = result.rows.map((row, index) => ({
    groupId: Number(row.group_id),
    groupName: row.name,
    groupAvatarEmoji: row.avatar_emoji,
    groupAvatarUrl: row.avatar_url ?? undefined,
    memberCount: Number(row.member_count),
    totalMinutes: Number(row.total_minutes),
    rank: index + 1,
    isUserGroup: userGroupIds.includes(Number(row.group_id)),
    isFriendGroup: friendGroupIdSet.has(Number(row.group_id)),
  }));

  return { entries, userGroupIds };
}