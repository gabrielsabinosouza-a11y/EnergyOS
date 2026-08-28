import pool from "../db";
import type { NewLeagueTier, LeagueGroup, LeagueGroupMember, CohortMember } from "@/types";
import { addCoins } from "./settings";

// Configuration
const PROMOTION_CUTOFFS: Record<NewLeagueTier, number> = {
  BRONZE:   10,
  PRATA:    10,
  OURO:     7,
  DIAMANTE: 5,   // top 5 qualify for Lendas
  LENDAS:   0,   // no promotion above Lendas
};
const REGULAR_TIER_COIN_REWARDS: [number, number, number] = [150, 100, 75];
const DEMOTION_COUNT = 3;        // bottom N demoted each week
const LEGENDS_TOP_N = 5;         // top N from each Diamante group qualify for Lendas
const LEGENDS_MAX_SIZE = 20;     // target Lendas group size

// Configurable Lendas top-3 coin rewards — tune without redeploy
export const LEGENDS_LEAGUE_REWARDS: [number, number, number] = [500, 300, 150];
const TIERS: NewLeagueTier[] = ["BRONZE", "PRATA", "OURO", "DIAMANTE", "LENDAS"];

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
  };
}

function getCurrentWeekDates(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
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

  // Create one group per non-Lendas tier; Lendas is created by promotion job
  for (const tier of TIERS.filter((t) => t !== "LENDAS")) {
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
    `select * from league_groups where week_start_date = $1`,
    [oldWeekStart]
  );
  if (!oldGroups.rows.length) return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const diamanteQualifiers: string[] = []; // profile IDs qualifying for Lendas

    for (const groupRow of oldGroups.rows) {
      const group = mapLeagueGroup(groupRow);
      const members = await client.query<LeagueGroupMemberRow>(
        `select * from league_group_members where league_group_id = $1 order by weekly_xp desc, joined_at`,
        [group.id]
      );
      const n = members.rows.length;
      if (n === 0) continue;

      const tierIdx = TIERS.indexOf(group.tier);
      const nextTier: NewLeagueTier | null = tierIdx < TIERS.indexOf("DIAMANTE") ? TIERS[tierIdx + 1] as NewLeagueTier : null;
      const prevTier: NewLeagueTier | null = tierIdx > 0 ? TIERS[tierIdx - 1] as NewLeagueTier : null;

      const promoCutoff = PROMOTION_CUTOFFS[group.tier];

      for (let i = 0; i < n; i++) {
        const member = members.rows[i];
        const rank = i + 1;
        let targetTier: NewLeagueTier = group.tier;

        if (group.tier === "DIAMANTE") {
          // Top LEGENDS_TOP_N qualify for Lendas; bottom DEMOTION_COUNT demote
          if (rank <= LEGENDS_TOP_N) {
            diamanteQualifiers.push(member.profile_id);
          } else if (prevTier && rank > n - DEMOTION_COUNT) {
            targetTier = prevTier;
          }
          // Award coins to top 3
          if (rank <= 3) {
            const coins = REGULAR_TIER_COIN_REWARDS[rank - 1];
            await addCoins(member.profile_id, coins, client);
          }
        } else if (group.tier === "LENDAS") {
          // Award coins to top 3; no promotion above Lendas
          if (rank <= 3) {
            const coins = LEGENDS_LEAGUE_REWARDS[rank - 1];
            await addCoins(member.profile_id, coins, client);
          }
          // Bottom DEMOTION_COUNT drop back to Diamante next week
          if (prevTier && rank > n - DEMOTION_COUNT) {
            targetTier = prevTier;
          }
        } else {
          // Bronze / Prata / Ouro — tier-specific promotion cutoff
          if (rank <= 3) {
            const coins = REGULAR_TIER_COIN_REWARDS[rank - 1];
            await addCoins(member.profile_id, coins, client);
          }
          if (nextTier && rank <= promoCutoff) targetTier = nextTier;
          else if (prevTier && rank > n - DEMOTION_COUNT) targetTier = prevTier;
        }

        // Ensure member is in the correct group for the new week
        if (targetTier !== "LENDAS") {
          await ensureMemberInNewWeekGroup(client, member.profile_id, targetTier, newWeekStart);
        }
        // Lendas members are placed by the Lendas promotion job below
      }
    }

    // ── Lendas promotion: aggregate top-N from all Diamante groups ──────────
    // Edge case: if fewer than LEGENDS_TOP_N qualifiers exist, we still create
    // the Lendas group — it just starts smaller. Minimum 1 member required.
    if (diamanteQualifiers.length > 0) {
      const legendsWeekEnd = new Date(newWeekStart);
      legendsWeekEnd.setDate(legendsWeekEnd.getDate() + 6);
      const legendsGroup = await client.query<LeagueGroupRow>(
        `insert into league_groups (tier, week_start_date, week_end_date, is_legends_group)
         values ('LENDAS', $1, $2, true)
         on conflict (tier, week_start_date) do update set tier = 'LENDAS'
         returning *`,
        [newWeekStart, legendsWeekEnd.toISOString().slice(0, 10)]
      );
      const legendsGroupId = Number(legendsGroup.rows[0].id);

      // Cap at LEGENDS_MAX_SIZE — take the highest-XP qualifiers if over cap
      const capped = diamanteQualifiers.slice(0, LEGENDS_MAX_SIZE);
      for (const profileId of capped) {
        await client.query(
          `insert into league_group_members (league_group_id, profile_id, weekly_xp)
           values ($1, $2, 0) on conflict (league_group_id, profile_id) do nothing`,
          [legendsGroupId, profileId]
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
}

export async function getOrCreateUserLeagueGroup(profileId: string): Promise<{ group: LeagueGroup; member: LeagueGroupMember }> {
  const { start } = getCurrentWeekDates();
  await initializeLeagueGroups(start);
  
  const existingMember = await pool.query<{ lg_id: string | number; tier: NewLeagueTier; is_legends: boolean }>(
    `select lg.id as lg_id, lg.tier, lg.is_legends_group as is_legends
     from league_groups lg join league_group_members lgm on lg.id = lgm.league_group_id
     where lgm.profile_id = $1 and lg.week_start_date = $2`,
    [profileId, start]
  );
  
  if (existingMember.rows[0]) {
    const group = await getLeagueGroupById(Number(existingMember.rows[0].lg_id));
    const member = await getLeagueGroupMember(Number(existingMember.rows[0].lg_id), profileId);
    return { group: group!, member: member! };
  }
  
  // For new users, start in BRONZE
  let tier: NewLeagueTier = "BRONZE";
  const userXP = await getUserWeeklyXP(profileId);
  if (userXP >= 5000) tier = "DIAMANTE";
  else if (userXP >= 3000) tier = "OURO";
  else if (userXP >= 1500) tier = "PRATA";

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
  const existing = await pool.query<{ id: string | number }>(
    `select id from league_group_members where league_group_id = $1 and profile_id = $2`,
    [groupId, profileId]
  );
  
  if (existing.rows[0]) {
    const result = await pool.query<LeagueGroupMemberRow>(
      `update league_group_members set weekly_xp = 0, rank = null where id = $1 returning *`,
      [existing.rows[0].id]
    );
    return mapLeagueGroupMember({ ...result.rows[0], display_name: undefined, photo_url: undefined, username: undefined });
  }
  
  const result = await pool.query<LeagueGroupMemberRow>(
    `insert into league_group_members (league_group_id, profile_id, weekly_xp, rank)
     values ($1, $2, 0, null) returning *`,
    [groupId, profileId]
  );
  return mapLeagueGroupMember({ ...result.rows[0], display_name: undefined, photo_url: undefined, username: undefined });
}

export async function getLeagueGroupMembers(groupId: number): Promise<LeagueGroupMember[]> {
  const result = await pool.query<LeagueGroupMemberRow & { display_name?: string; photo_url?: string; username?: string }>(
    `select lgm.*, p.display_name, p.photo_url, p.username, p.equipped_decoration_id
     from league_group_members lgm left join profiles p on lgm.profile_id = p.id
     where lgm.league_group_id = $1 order by lgm.weekly_xp desc, lgm.joined_at`,
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
  const result = await pool.query<{ id: string | number; weekly_xp: number }>(
    `select id, weekly_xp from league_group_members where league_group_id = $1 order by weekly_xp desc, joined_at`,
    [groupId]
  );
  for (let i = 0; i < result.rows.length; i++) {
    await pool.query(`update league_group_members set rank = $1 where id = $2`, [i + 1, result.rows[i].id]);
  }
}

export type LeagueNewSnapshot = Awaited<ReturnType<typeof getUserLeagueSnapshot>> & {
  liveCohort: { members: CohortMember[] };
};

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
  
  const { group, member } = await getOrCreateUserLeagueGroup(profileId);
  const members = await getLeagueGroupMembers(group.id);
  await calculateGroupRanks(group.id);
  
  const updatedMember = await getLeagueGroupMember(group.id, profileId);
  
  return {
    currentTier: group.tier,
    currentGroup: group,
    members,
    userRank: updatedMember?.rank ?? 0,
    weekStart: start,
    weekEnd: end,
    isLegendsGroup: group.isLegendsGroup,
    promotionZoneEnd: PROMOTION_CUTOFFS[group.tier],
    demotionZoneStart: Math.max(1, members.length - DEMOTION_COUNT + 1),
  };
}

export async function getUserWeeklyXP(profileId: string): Promise<number> {
  const { start } = getCurrentWeekDates();
  const result = await pool.query<{ total_xp: string }>(
    `select coalesce(sum(xp_amount), 0)::int as total_xp from xp_ledger where profile_id = $1 and created_at >= $2`,
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
  const { start } = getCurrentWeekDates();
  const { group } = await getOrCreateUserLeagueGroup(profileId);
  await updateMemberWeeklyXP(group.id, profileId, xp);
}
