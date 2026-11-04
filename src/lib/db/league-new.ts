import pool from "../db";
import type { NewLeagueTier, LeagueGroup, LeagueGroupMember, CohortMember } from "@/types";
import { addCoins } from "./settings";
import { addDaysIso, todayIso, weekStartIso } from "./dates";
import {
  DEMOTION_START_RANK,
  INITIAL_TIER_XP,
  LEAGUE_REWARDS,
  LEGENDS_MAX_SIZE,
  NEW_TIER_ORDER,
  PROMOTION_TOP,
  getLeagueZone,
  tierAfterWeeklyRank,
} from "@/lib/league-new-meta";
import { persistLeagueWeeklyResultOnce } from "@/lib/league-reset";

export function tierRank(tier: NewLeagueTier): number {
  return NEW_TIER_ORDER.indexOf(tier);
}

async function recordHighestTier(db: Queryable, profileId: string, tier: NewLeagueTier): Promise<void> {
  await db.query(
    `update profiles set highest_league_tier = $2::league_tier
     where id = $1
        and (highest_league_tier is null
             or array_position($3::text[], highest_league_tier::text)
                < array_position($3::text[], $2::text))`,
    [profileId, tier, NEW_TIER_ORDER],
  );
}

interface LeagueGroupRow {
  id: string | number;
  tier: NewLeagueTier;
  week_start_date: Date | string;
  week_end_date: Date | string;
  is_legends_group: boolean;
  created_at: Date | string;
}

interface LeagueGroupMemberRow {
  id: string | number;
  league_group_id: string | number;
  profile_id: string;
  weekly_xp: number;
  rank: number | null;
  joined_at: Date | string;
  weekly_xp_reached_at?: Date | string | null;
  times_top_1_global?: number;
}

function compareReachedAt(
  left: Date | string | null | undefined,
  right: Date | string | null | undefined,
): number {
  const leftTime = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;
  return leftTime - rightTime;
}

async function getRankedGroupMembers(
  db: Queryable,
  groupId: number,
  weekStart: string,
): Promise<LeagueGroupMemberRow[]> {
  const result = await db.query<LeagueGroupMemberRow>(
    `select lgm.*, reached.reached_at as weekly_xp_reached_at,
            p.times_top_1_global
     from league_group_members lgm
     left join profiles p on p.id = lgm.profile_id
     left join lateral (
       select min(events.created_at) as reached_at
       from (
         select created_at,
                sum(xp_amount) over (order by created_at, id) as cumulative_xp
         from xp_ledger
         where profile_id = lgm.profile_id
           and created_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'
           and created_at < (($2::date + 7))::timestamp at time zone 'America/Sao_Paulo'
       ) events
       where events.cumulative_xp >= lgm.weekly_xp
     ) reached on lgm.weekly_xp > 0
     where lgm.league_group_id = $1
     order by lgm.weekly_xp desc, reached.reached_at asc nulls last, lgm.joined_at, lgm.id`,
    [groupId, weekStart],
  );
  for (let index = 0; index < result.rows.length; index += 1) {
    await db.query(`update league_group_members set rank = $1 where id = $2`, [
      index + 1,
      result.rows[index].id,
    ]);
  }
  return result.rows;
}

function mapLeagueGroup(row: LeagueGroupRow): LeagueGroup {
  return {
    id: Number(row.id),
    tier: row.tier,
    weekStartDate: typeof row.week_start_date === "string" ? row.week_start_date : row.week_start_date.toISOString().slice(0, 10),
    weekEndDate: typeof row.week_end_date === "string" ? row.week_end_date : row.week_end_date.toISOString().slice(0, 10),
    isLegendsGroup: row.is_legends_group,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

function mapLeagueGroupMember(row: LeagueGroupMemberRow & { display_name?: string; photo_url?: string; username?: string; equipped_decoration_id?: string | null }): LeagueGroupMember {
  return {
    id: Number(row.id),
    leagueGroupId: Number(row.league_group_id),
    profileId: row.profile_id,
    displayName: row.display_name,
    profile: row.display_name ? {
      id: row.profile_id,
      displayName: row.display_name,
      photoUrl: row.photo_url ?? undefined,
      username: row.username ?? undefined,
      equippedDecorationId: row.equipped_decoration_id ?? undefined,
    } : undefined,
    weeklyXP: row.weekly_xp,
    rank: row.rank ?? 0,
    joinedAt: typeof row.joined_at === "string" ? row.joined_at : row.joined_at.toISOString(),
    timesTop1Global: Number(row.times_top_1_global ?? 0),
  };
}

function getCurrentWeekDates(): { start: string; end: string } {
  const start = weekStartIso(todayIso());
  return { start, end: addDaysIso(start, 6) };
}

type Queryable = { query: typeof pool.query };

/** Recompute a group's weekly_xp from the XP ledger for that week (São Paulo). */
async function syncGroupWeeklyXPFromLedger(db: Queryable, groupId: number, weekStart: string): Promise<void> {
  await db.query(
    `update league_group_members lgm
     set weekly_xp = coalesce((
       select sum(xl.xp_amount)::int
       from xp_ledger xl
       where xl.profile_id = lgm.profile_id
         and xl.created_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'
         and xl.created_at < (($2::date + 7))::timestamp at time zone 'America/Sao_Paulo'
     ), 0)
     where lgm.league_group_id = $1`,
    [groupId, weekStart],
  );
}

function getNextWeekStart(): string {
  const { start } = getCurrentWeekDates();
  const nextWeek = new Date(start);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().slice(0, 10);
}

export async function initializeLeagueGroups(weekStart: string): Promise<void> {
  const existing = await pool.query<{ count: string }>(
    `select count(*)::int as count from league_groups where week_start_date = $1`,
    [weekStart]
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Legends is created by the weekly qualification process.
  for (const tier of NEW_TIER_ORDER.filter((t) => t !== "LEGENDS")) {
    await pool.query(
      `insert into league_groups (tier, week_start_date, week_end_date, is_legends_group)
       values ($1, $2, $3, false) on conflict (tier, week_start_date) do nothing`,
      [tier, weekStart, weekEndStr]
    );
  }
}

// ─── Weekly reset + promotion/demotion ───────────────────────────────────────

export async function runWeeklyLeagueReset(): Promise<void> {
  const { start: newWeekStart } = getCurrentWeekDates();
  const prevWeekStart = new Date(newWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const oldWeekStart = prevWeekStart.toISOString().slice(0, 10);

  // Check if old week groups exist and haven't been processed
  const oldGroups = await pool.query<LeagueGroupRow>(
    `select * from league_groups where week_start_date = $1 and reset_at is null order by id`,
    [oldWeekStart]
  );
  if (!oldGroups.rows.length) return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const legendsCandidates: Array<{
      profileId: string;
      weeklyXP: number;
      returningLegend: boolean;
      reachedAt: Date | string | null | undefined;
    }> = [];

    for (const groupRow of oldGroups.rows) {
      const group = mapLeagueGroup(groupRow);
      const reset = await client.query<{ reset_at: Date | string | null }>(
        `select reset_at from league_groups where id = $1 for update`,
        [group.id],
      );
      if (!reset.rows[0] || reset.rows[0].reset_at) continue;

      await syncGroupWeeklyXPFromLedger(client, group.id, oldWeekStart);
      const members = await getRankedGroupMembers(client, group.id, oldWeekStart);
      const n = members.length;

      for (let i = 0; i < n; i++) {
        const member = members[i];
        const rank = i + 1;
        const targetTier = tierAfterWeeklyRank(group.tier, rank, n, member.weekly_xp);

        if (group.tier === "OBSIDIAN" && targetTier === "LEGENDS") {
          legendsCandidates.push({
            profileId: member.profile_id,
            weeklyXP: member.weekly_xp,
            returningLegend: false,
            reachedAt: member.weekly_xp_reached_at,
          });
        } else if (group.tier === "LEGENDS" && targetTier === "LEGENDS") {
          legendsCandidates.push({
            profileId: member.profile_id,
            weeklyXP: member.weekly_xp,
            returningLegend: true,
            reachedAt: member.weekly_xp_reached_at,
          });
        }

        const zone = getLeagueZone(group.tier, rank, n);
        const coinsAwarded = member.weekly_xp > 0 &&
          (zone === "promotion" || zone === "reward")
          ? LEAGUE_REWARDS[group.tier][rank - 1]
          : 0;
        const result = targetTier === group.tier
          ? "stayed"
          : NEW_TIER_ORDER.indexOf(targetTier) > NEW_TIER_ORDER.indexOf(group.tier)
            ? "promoted"
            : "demoted";

        await persistLeagueWeeklyResultOnce({
          recordResultIfAbsent: async (weeklyResult) => {
            const inserted = await client.query(
              `insert into league_weekly_results
                 (profile_id, league_group_id, week_start_date, tier, rank, weekly_xp,
                  result, resulting_tier, coins_awarded, zone)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               on conflict (league_group_id, profile_id) do nothing
               returning id`,
              [
                weeklyResult.profileId,
                weeklyResult.groupId,
                weeklyResult.weekStart,
                weeklyResult.tier,
                weeklyResult.rank,
                weeklyResult.weeklyXP,
                weeklyResult.result,
                weeklyResult.resultingTier,
                weeklyResult.coinsAwarded,
                zone,
              ],
            );
            return Boolean(inserted.rows[0]);
          },
          awardCoins: async (payout) => {
            const inserted = await client.query(
              `insert into coin_transactions
                 (profile_id, amount, reason, tier, rank, week_start_date, league_group_id, reference_key, reward_kind)
               values ($1, $2, 'league_reward', $3, $4, $5, $6, $7, $8)
               on conflict (reference_key) do nothing
               returning id`,
              [
                payout.profileId,
                payout.amount,
                payout.tier,
                payout.rank,
                payout.weekStart,
                group.id,
                payout.referenceKey,
                payout.rewardKind,
              ],
            );
            if (inserted.rows[0]) await addCoins(payout.profileId, payout.amount, client);
          },
          recordTop1GlobalFinish: async (profileId, weekStart) => {
            const previous = await client.query<{ unlocked_tier: number }>(
              `select unlocked_tier from user_achievement_progress
               where profile_id = $1 and achievement_id = 'top_1_global'
               for update`,
              [profileId],
            );
            const firstUnlock = (previous.rows[0]?.unlocked_tier ?? 0) === 0;
            await client.query(
              `update profiles
               set times_top_1_global = times_top_1_global + 1,
                   last_top_1_global_week = $2
               where id = $1`,
              [profileId, weekStart],
            );
            await client.query(
              `insert into user_achievement_progress
                 (profile_id, achievement_id, current_value, unlocked_tier, unlocked_at, seen_at)
               select $1, 'top_1_global', times_top_1_global, 1, now(), null
               from profiles where id = $1
               on conflict (profile_id, achievement_id) do update set
                 current_value = excluded.current_value,
                 unlocked_tier = 1,
                 unlocked_at = coalesce(user_achievement_progress.unlocked_at, now()),
                 seen_at = case
                   when user_achievement_progress.unlocked_tier = 0 then null
                   else user_achievement_progress.seen_at
                 end`,
              [profileId],
            );
            return firstUnlock;
          },
          addFirstUnlockBonusToResult: async (profileId, groupId, amount) => {
            await client.query(
              `update league_weekly_results
               set coins_awarded = coins_awarded + $3
               where profile_id = $1 and league_group_id = $2`,
              [profileId, groupId, amount],
            );
          },
        }, {
          profileId: member.profile_id,
          groupId: group.id,
          weekStart: oldWeekStart,
          tier: group.tier,
          rank,
          groupSize: n,
          weeklyXP: member.weekly_xp,
          coinsAwarded,
          result,
          resultingTier: targetTier,
        });

        if (targetTier !== "LEGENDS") await recordHighestTier(client, member.profile_id, targetTier);

        // Ensure member is in the correct group for the new week
        if (targetTier !== "LEGENDS") {
          await ensureMemberInNewWeekGroup(client, member.profile_id, targetTier, newWeekStart);
        }

      }
      await client.query(`update league_groups set reset_at = now() where id = $1`, [group.id]);
    }

    // Keep eligible Legends and admit the highest-ranked Obsidian qualifiers.
    const uniqueCandidates = [...new Map(legendsCandidates.map((candidate) => [candidate.profileId, candidate])).values()]
      .sort((a, b) => b.weeklyXP - a.weeklyXP
        || Number(b.returningLegend) - Number(a.returningLegend)
        || compareReachedAt(a.reachedAt, b.reachedAt)
        || a.profileId.localeCompare(b.profileId));
    if (uniqueCandidates.length > 0) {
      const legendsWeekEnd = new Date(newWeekStart);
      legendsWeekEnd.setDate(legendsWeekEnd.getDate() + 6);
      const legendsGroup = await client.query<LeagueGroupRow>(
        `insert into league_groups (tier, week_start_date, week_end_date, is_legends_group)
         values ('LEGENDS', $1, $2, true)
         on conflict (tier, week_start_date) do update set tier = 'LEGENDS'
         returning *`,
        [newWeekStart, legendsWeekEnd.toISOString().slice(0, 10)]
      );
      const legendsGroupId = Number(legendsGroup.rows[0].id);

      for (const candidate of uniqueCandidates) {
        const isLegend = uniqueCandidates.indexOf(candidate) < LEGENDS_MAX_SIZE;
        const targetTier = isLegend ? "LEGENDS" : "OBSIDIAN";
        await recordHighestTier(client, candidate.profileId, targetTier);
        if (!isLegend) {
          await ensureMemberInNewWeekGroup(client, candidate.profileId, targetTier, newWeekStart);
          continue;
        }
        await client.query(
          `insert into league_group_members (league_group_id, profile_id, weekly_xp)
           values ($1, $2, 0) on conflict (league_group_id, profile_id) do nothing`,
          [legendsGroupId, candidate.profileId]
        );
        // Remove any stale same-week membership so qualifiers aren't listed twice
        await client.query(
          `delete from league_group_members
            where profile_id = $1
              and league_group_id in (
                select lg.id from league_groups lg
                 where lg.week_start_date = $2 and lg.id <> $3
              )`,
          [candidate.profileId, newWeekStart, legendsGroupId]
        );
      }
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

async function ensureMemberInNewWeekGroup(
  client: { query: typeof pool.query },
  profileId: string,
  tier: NewLeagueTier,
  weekStart: string
): Promise<void> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const group = await client.query<{ id: string | number }>(
    `insert into league_groups (tier, week_start_date, week_end_date, is_legends_group)
     values ($1, $2, $3, false)
     on conflict (tier, week_start_date) do update set tier = excluded.tier
     returning id`,
    [tier, weekStart, weekEnd.toISOString().slice(0, 10)]
  );
  const groupId = Number(group.rows[0].id);
  await client.query(
    `insert into league_group_members (league_group_id, profile_id, weekly_xp)
     values ($1, $2, 0) on conflict (league_group_id, profile_id) do nothing`,
    [groupId, profileId]
  );
  // A user must never hold more than one membership per week. If a stale
  // same-week membership exists in another (usually lower) tier group — e.g.
  // from getOrCreateUserLeagueGroup running before the weekly reset — remove it
  // so the user is only listed once, in their correct tier.
  await client.query(
    `delete from league_group_members
      where profile_id = $1
        and league_group_id in (
          select lg.id from league_groups lg
           where lg.week_start_date = $2 and lg.id <> $3
        )`,
    [profileId, weekStart, groupId]
  );
}

export async function getOrCreateUserLeagueGroup(profileId: string): Promise<{ group: LeagueGroup; member: LeagueGroupMember }> {
  const { start } = getCurrentWeekDates();
  await initializeLeagueGroups(start);
  
  const existingMember = await pool.query<{ lg_id: string | number; tier: NewLeagueTier; is_legends: boolean }>(
    `select lg.id as lg_id, lg.tier, lg.is_legends_group as is_legends
     from league_groups lg join league_group_members lgm on lg.id = lgm.league_group_id
     where lgm.profile_id = $1 and lg.week_start_date = $2
     order by array_position($3::text[], lg.tier) desc
     limit 1`,
    [profileId, start, NEW_TIER_ORDER]
  );
  
  if (existingMember.rows[0]) {
    const group = await getLeagueGroupById(Number(existingMember.rows[0].lg_id));
    const member = await getLeagueGroupMember(Number(existingMember.rows[0].lg_id), profileId);
    if (!group || !member) {
      // This shouldn't happen, but handle it gracefully
      throw new Error("League group or member not found");
    }
    return { group, member };
  }
  
  // For new users, start in BRONZE
  const userXP = await getUserWeeklyXP(profileId);
  const tier = [...NEW_TIER_ORDER].reverse().find((candidate) => {
    const threshold = INITIAL_TIER_XP[candidate];
    return threshold !== undefined && userXP >= threshold;
  }) ?? "BRONZE";
  await recordHighestTier(pool, profileId, tier);

  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  let group = await getLeagueGroupByTierAndWeek(tier, start);
  if (!group) {
    const result = await pool.query<LeagueGroupRow>(
      `insert into league_groups (tier, week_start_date, week_end_date, is_legends_group)
       values ($1, $2, $3, false) returning id, tier, week_start_date, week_end_date, is_legends_group, created_at`,
      [tier, start, weekEndStr]
    );
    group = mapLeagueGroup(result.rows[0]);
  }
  
  const member = await addMemberToGroup(group.id, profileId);
  return { group, member };
}

export async function getLeagueGroupById(id: number): Promise<LeagueGroup | null> {
  const result = await pool.query<LeagueGroupRow>(
    `select id, tier, week_start_date, week_end_date, is_legends_group, created_at
     from league_groups where id = $1`,
    [id]
  );
  return result.rows[0] ? mapLeagueGroup(result.rows[0]) : null;
}

export async function getLeagueGroupByTierAndWeek(tier: NewLeagueTier, weekStart: string): Promise<LeagueGroup | null> {
  const result = await pool.query<LeagueGroupRow>(
    `select id, tier, week_start_date, week_end_date, is_legends_group, created_at
     from league_groups where tier = $1 and week_start_date = $2`,
    [tier, weekStart]
  );
  return result.rows[0] ? mapLeagueGroup(result.rows[0]) : null;
}

export async function addMemberToGroup(groupId: number, profileId: string): Promise<LeagueGroupMember> {
  const existing = await pool.query<LeagueGroupMemberRow>(
    `select * from league_group_members where league_group_id = $1 and profile_id = $2`,
    [groupId, profileId]
  );

  if (existing.rows[0]) {
    return mapLeagueGroupMember({ ...existing.rows[0], display_name: undefined, photo_url: undefined, username: undefined });
  }

  const weeklyXP = await getUserWeeklyXP(profileId);
  const result = await pool.query<LeagueGroupMemberRow>(
    `insert into league_group_members (league_group_id, profile_id, weekly_xp, rank)
     values ($1, $2, $3, null)
     on conflict (league_group_id, profile_id) do update set weekly_xp = greatest(league_group_members.weekly_xp, excluded.weekly_xp)
     returning *`,
    [groupId, profileId, weeklyXP]
  );
  return mapLeagueGroupMember({ ...result.rows[0], display_name: undefined, photo_url: undefined, username: undefined });
}

export async function getLeagueGroupMembers(groupId: number): Promise<LeagueGroupMember[]> {
  const result = await pool.query<LeagueGroupMemberRow & { display_name?: string; photo_url?: string; username?: string }>(
    `select lgm.*, p.display_name, p.photo_url, p.username, p.equipped_decoration_id,
            p.times_top_1_global
     from league_group_members lgm left join profiles p on lgm.profile_id = p.id
     where lgm.league_group_id = $1 order by lgm.rank asc nulls last, lgm.weekly_xp desc, lgm.joined_at, lgm.id`,
    [groupId]
  );
  return result.rows.map(mapLeagueGroupMember);
}

export async function getLeagueGroupMember(groupId: number, profileId: string): Promise<LeagueGroupMember | null> {
  const result = await pool.query<LeagueGroupMemberRow & { display_name?: string; photo_url?: string; username?: string }>(
    `select lgm.*, p.display_name, p.photo_url, p.username, p.equipped_decoration_id
     from league_group_members lgm left join profiles p on lgm.profile_id = p.id
     where lgm.league_group_id = $1 and lgm.profile_id = $2`,
    [groupId, profileId]
  );
  return result.rows[0] ? mapLeagueGroupMember(result.rows[0]) : null;
}

export async function updateMemberWeeklyXP(groupId: number, profileId: string, xp: number): Promise<void> {
  await pool.query(
    `update league_group_members set weekly_xp = weekly_xp + $1 where league_group_id = $2 and profile_id = $3`,
    [xp, groupId, profileId]
  );
}

export async function calculateGroupRanks(groupId: number): Promise<void> {
  const group = await pool.query<{ week_start_date: Date | string }>(
    `select week_start_date from league_groups where id = $1`,
    [groupId]
  );
  const weekStart = group.rows[0]?.week_start_date;
  if (!weekStart) return;
  await getRankedGroupMembers(
    pool,
    groupId,
    typeof weekStart === "string" ? weekStart.slice(0, 10) : weekStart.toISOString().slice(0, 10),
  );
}

export type LeagueNewSnapshot = Awaited<ReturnType<typeof getUserLeagueSnapshot>> & {
  liveCohort: { members: CohortMember[] };
};

export interface LeagueWeeklyResultNotification {
  id: number;
  weekStart: string;
  tier: NewLeagueTier;
  rank: number;
  result: "promoted" | "demoted" | "stayed";
  resultingTier: NewLeagueTier;
  coinsAwarded: number;
}

export async function getPendingLeagueWeeklyResults(profileId: string): Promise<LeagueWeeklyResultNotification[]> {
  const result = await pool.query<{
    id: string | number;
    week_start_date: Date | string;
    tier: NewLeagueTier;
    rank: number;
    result: LeagueWeeklyResultNotification["result"];
    resulting_tier: NewLeagueTier;
    coins_awarded: number;
  }>(
    `select id, week_start_date, tier, rank, result, resulting_tier, coins_awarded
     from league_weekly_results
     where profile_id = $1 and notified_at is null
     order by week_start_date desc, rank asc
     limit 10`,
    [profileId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    weekStart: typeof row.week_start_date === "string"
      ? row.week_start_date.slice(0, 10)
      : row.week_start_date.toISOString().slice(0, 10),
    tier: row.tier,
    rank: row.rank,
    result: row.result,
    resultingTier: row.resulting_tier,
    coinsAwarded: row.coins_awarded,
  })).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.rank - b.rank);
}

export async function acknowledgeLeagueWeeklyResults(profileId: string, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `update league_weekly_results
     set notified_at = now()
     where profile_id = $1 and notified_at is null and id = any($2::bigint[])`,
    [profileId, ids],
  );
}

export async function getUserLeagueSnapshot(profileId: string): Promise<{
  currentTier: NewLeagueTier;
  currentGroup: LeagueGroup;
  members: LeagueGroupMember[];
  userRank: number;
  weekStart: string;
  weekEnd: string;
  isLegendsGroup: boolean;
  promotionZoneEnd: number;
  demotionZoneStart: number;
}> {
  const { start, end } = getCurrentWeekDates();
  await initializeLeagueGroups(start);
  
  const { group } = await getOrCreateUserLeagueGroup(profileId);
  await syncGroupWeeklyXPFromLedger(pool, group.id, start);
  await calculateGroupRanks(group.id);
  const members = await getLeagueGroupMembers(group.id);
  const updatedMember = await getLeagueGroupMember(group.id, profileId);
  
  return {
    currentTier: group.tier,
    currentGroup: group,
    members,
    userRank: updatedMember?.rank ?? 0,
    weekStart: start,
    weekEnd: end,
    isLegendsGroup: group.isLegendsGroup,
    promotionZoneEnd: group.tier === "LEGENDS" ? 0 : PROMOTION_TOP,
    demotionZoneStart: group.tier !== "BRONZE" && members.length >= DEMOTION_START_RANK
      ? DEMOTION_START_RANK
      : 0,
  };
}

export async function getUserWeeklyXP(profileId: string, weekStart?: string): Promise<number> {
  const start = weekStart ?? getCurrentWeekDates().start;
  const result = await pool.query<{ total_xp: string }>(
    `select coalesce(sum(xp_amount), 0)::int as total_xp
     from xp_ledger
     where profile_id = $1
       and created_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'
       and created_at < (($2::date + 7))::timestamp at time zone 'America/Sao_Paulo'`,
    [profileId, start]
  );
  return Number(result.rows[0]?.total_xp ?? 0);
}

export async function getLiveCohort(profileId: string): Promise<CohortMember[]> {
  const userSession = await pool.query<{ started_at: Date | string }>(
    `select started_at from focus_sessions where profile_id = $1 order by started_at desc limit 1`,
    [profileId]
  );
  
  if (!userSession.rows[0]) return [];
  
  const userStartTime = new Date(userSession.rows[0].started_at);
  const oneHourBefore = new Date(userStartTime.getTime() - 60 * 60 * 1000);
  const oneHourAfter = new Date(userStartTime.getTime() + 60 * 60 * 1000);
  
  const cohort = await pool.query<{ profile_id: string; display_name: string; photo_url: string | null; started_at: Date | string }>(
    `select p.id as profile_id, p.display_name, p.photo_url, fs.started_at
     from focus_sessions fs join profiles p on fs.profile_id = p.id
     where fs.started_at >= $1 and fs.started_at <= $2
       and (
         exists (select 1 from friendships f where f.requester_id = $3 and f.addressee_id = p.id and f.status = 'accepted')
         or exists (select 1 from friendships f where f.requester_id = p.id and f.addressee_id = $3 and f.status = 'accepted')
       )
       and p.id != $3
     order by fs.started_at desc`,
    [oneHourBefore, oneHourAfter, profileId]
  );
  
  return cohort.rows.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    photoUrl: row.photo_url ?? undefined,
    sessionStartTime: typeof row.started_at === "string" ? row.started_at : row.started_at.toISOString(),
  }));
}

export async function addLeagueXP(profileId: string, xp: number): Promise<void> {
  if (!Number.isFinite(xp) || xp <= 0) return;
  const { group } = await getOrCreateUserLeagueGroup(profileId);
  const weeklyXP = await getUserWeeklyXP(profileId);
  await pool.query(
    `update league_group_members set weekly_xp = $1 where league_group_id = $2 and profile_id = $3`,
    [weeklyXP, group.id, profileId],
  );
}

/**
 * Recalcula o weekly_xp do usuário a partir do ledger da semana — par do
 * `addLeagueXP` para quando XP é ESTORNADO (desmarcar meta concluída, subir o
 * alvo). `addLeagueXP` ignora xp <= 0, então o estorno precisa deste caminho.
 * Falha de liga nunca derruba a operação principal (é apenas um placar):
 * erro é logado e engolido.
 */
export async function recomputeWeeklyLeagueXP(profileId: string): Promise<void> {
  try {
    const { group } = await getOrCreateUserLeagueGroup(profileId);
    const weeklyXP = await getUserWeeklyXP(profileId);
    await pool.query(
      `update league_group_members set weekly_xp = $1 where league_group_id = $2 and profile_id = $3`,
      [weeklyXP, group.id, profileId],
    );
  } catch (error) {
    console.error("[league] Falha ao recalcular XP semanal após estorno:", error);
  }
}
