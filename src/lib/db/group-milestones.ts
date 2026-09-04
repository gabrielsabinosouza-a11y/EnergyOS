import pool from "../db";
import { addCoins } from "./settings";
import { getGroupTotalMinutes } from "./group-leaderboard";
import { weekStartIso, todayIso, addDaysIso } from "./dates";
import { parseProfileId } from "./validation";

// ─── Milestone definitions ────────────────────────────────────────────────────

export interface MilestoneDef {
  thresholdMinutes: number;
  coinsPerMember: number;
  badgeKey: string | null;
  label: string;
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  { thresholdMinutes: 500,   coinsPerMember: 50,  badgeKey: null,              label: "500 min combinados"   },
  { thresholdMinutes: 2000,  coinsPerMember: 100, badgeKey: "frame_active",    label: "2.000 min combinados" },
  { thresholdMinutes: 5000,  coinsPerMember: 150, badgeKey: null,              label: "5.000 min combinados" },
  { thresholdMinutes: 10000, coinsPerMember: 250, badgeKey: "grupo_lendario",  label: "10.000 min combinados"},
  { thresholdMinutes: 25000, coinsPerMember: 500, badgeKey: "grupo_mitico",    label: "25.000 min combinados"},
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupMilestoneStatus {
  thresholdMinutes: number;
  coinsPerMember: number;
  badgeKey: string | null;
  label: string;
  unlockedAt: string | null;   // null = not yet unlocked
  claimedAt: string | null;    // null = not yet claimed by this user
}

export interface GroupWeeklyQuestStatus {
  weekStart: string;
  targetMinutes: number;
  coinsPerMember: number;
  currentMinutes: number;
  completedAt: string | null;
  claimedAt: string | null;
  contributedMinutes: number;  // this user's contribution this week
}

// ─── Milestone helpers ────────────────────────────────────────────────────────

/**
 * Auto-credit coins to every current group member who contributed at least one
 * minute. Idempotent: the unique claims constraint plus `on conflict do nothing`
 * guarantees each member is rewarded exactly once per milestone.
 */
async function creditMilestoneContributors(
  groupId: number,
  thresholdMinutes: number,
  coinsPerMember: number,
): Promise<void> {
  const contributors = await pool.query<{ profile_id: string }>(
    `select distinct gfc.profile_id
     from group_focus_contributions gfc
     join group_members gm on gm.group_id = gfc.group_id and gm.profile_id = gfc.profile_id
     where gfc.group_id = $1`,
    [groupId],
  );

  for (const { profile_id } of contributors.rows) {
    const inserted = await pool.query(
      `insert into group_milestone_claims (group_id, profile_id, threshold_minutes, coins_awarded)
       values ($1, $2, $3, $4)
       on conflict (group_id, profile_id, threshold_minutes) do nothing
       returning id`,
      [groupId, profile_id, thresholdMinutes, coinsPerMember],
    );
    if (inserted.rows[0]) await addCoins(profile_id, coinsPerMember);
  }
}

/**
 * Unlock a milestone (idempotent) and, only when it was actually unlocked just
 * now, auto-credit its reward to every contributing member.
 */
async function unlockMilestoneAndAutoCredit(groupId: number, def: MilestoneDef): Promise<void> {
  const result = await pool.query<{ id: number }>(
    `insert into group_activity_milestones (group_id, threshold_minutes, coins_per_member, badge_key)
     values ($1, $2, $3, $4)
     on conflict (group_id, threshold_minutes) do nothing
     returning id`,
    [groupId, def.thresholdMinutes, def.coinsPerMember, def.badgeKey],
  );

  if (!result.rows[0]) return; // already unlocked — skip reward distribution

  await creditMilestoneContributors(groupId, def.thresholdMinutes, def.coinsPerMember);
}

/**
 * After every focus session, call this to unlock any newly crossed milestones
 * and award coins to all contributing members automatically.
 */
export async function checkAndUnlockMilestones(groupId: number): Promise<void> {
  const totalMinutes = await getGroupTotalMinutes(groupId, "ALL_TIME");

  for (const def of MILESTONE_DEFS) {
    if (totalMinutes >= def.thresholdMinutes) {
      await unlockMilestoneAndAutoCredit(groupId, def);
    }
  }
}

/**
 * Get milestone status for a group from a specific member's perspective.
 */
export async function getGroupMilestones(
  profileId: string,
  groupId: number,
): Promise<{ milestones: GroupMilestoneStatus[]; totalMinutes: number }> {
  parseProfileId(profileId);

  const totalMinutes = await getGroupTotalMinutes(groupId, "ALL_TIME");

  // Live completion check: unlock (and reward) any threshold already crossed.
  // This covers historical/backfilled minutes that predate the milestone rows,
  // so completion reflects actual current progress instead of a stale label.
  for (const def of MILESTONE_DEFS) {
    if (totalMinutes >= def.thresholdMinutes) {
      await unlockMilestoneAndAutoCredit(groupId, def);
    }
  }

  const unlocked = await pool.query<{ threshold_minutes: number; unlocked_at: string }>(
    `select threshold_minutes, unlocked_at::text from group_activity_milestones where group_id = $1`,
    [groupId],
  );
  const unlockedMap = new Map(unlocked.rows.map((r) => [r.threshold_minutes, r.unlocked_at]));

  const claimed = await pool.query<{ threshold_minutes: number; claimed_at: string }>(
    `select threshold_minutes, claimed_at::text from group_milestone_claims
     where group_id = $1 and profile_id = $2`,
    [groupId, profileId],
  );
  const claimedMap = new Map(claimed.rows.map((r) => [r.threshold_minutes, r.claimed_at]));

  const milestones: GroupMilestoneStatus[] = MILESTONE_DEFS.map((def) => ({
    thresholdMinutes: def.thresholdMinutes,
    coinsPerMember: def.coinsPerMember,
    badgeKey: def.badgeKey,
    label: def.label,
    unlockedAt: unlockedMap.get(def.thresholdMinutes) ?? null,
    claimedAt: claimedMap.get(def.thresholdMinutes) ?? null,
  }));

  return { milestones, totalMinutes };
}

// ─── Weekly group quest ───────────────────────────────────────────────────────

const WEEKLY_QUEST_TARGET = 500;   // combined minutes
const WEEKLY_QUEST_COINS  = 50;    // per contributing member

/**
 * Ensure a weekly quest row exists for the current week.
 */
export async function ensureGroupWeeklyQuest(groupId: number): Promise<void> {
  const weekStart = weekStartIso(todayIso());
  await pool.query(
    `insert into group_weekly_quests (group_id, week_start, target_minutes, coins_per_member)
     values ($1, $2, $3, $4)
     on conflict (group_id, week_start) do nothing`,
    [groupId, weekStart, WEEKLY_QUEST_TARGET, WEEKLY_QUEST_COINS],
  );
}

/**
 * Get the current week's group quest status for a specific member.
 */
export async function getGroupWeeklyQuest(
  profileId: string,
  groupId: number,
): Promise<GroupWeeklyQuestStatus> {
  parseProfileId(profileId);
  await ensureGroupWeeklyQuest(groupId);

  const weekStart = weekStartIso(todayIso());

  const quest = await pool.query<{
    target_minutes: number;
    coins_per_member: number;
    completed_at: string | null;
  }>(
    `select target_minutes, coins_per_member, completed_at::text
     from group_weekly_quests where group_id = $1 and week_start = $2`,
    [groupId, weekStart],
  );

  const row = quest.rows[0]!;

  // Current week combined minutes
  const currentMinutes = await getGroupTotalMinutes(groupId, "WEEK");

  // Auto-complete if threshold crossed and not yet marked
  if (currentMinutes >= row.target_minutes && !row.completed_at) {
    await pool.query(
      `update group_weekly_quests set completed_at = now()
       where group_id = $1 and week_start = $2 and completed_at is null`,
      [groupId, weekStart],
    );
    row.completed_at = new Date().toISOString();
  }

  // Auto-credit the reward to every contributing member once the quest is
  // complete. Idempotent: the unique claims constraint plus `on conflict do
  // nothing` guarantees each member is rewarded exactly once per week.
  if (row.completed_at) {
    await creditWeeklyQuestContributors(groupId, weekStart, row.coins_per_member);
  }

  // This user's contribution this week
  const userContrib = await pool.query<{ minutes: number }>(
    `select coalesce(sum(minutes), 0)::int as minutes
     from group_focus_contributions
     where group_id = $1 and profile_id = $2
       and contributed_at >= ($3::date)::timestamptz`,
    [groupId, profileId, weekStart],
  );

  const claimed = await pool.query<{ claimed_at: string }>(
    `select claimed_at::text from group_weekly_quest_claims
     where group_id = $1 and profile_id = $2 and week_start = $3`,
    [groupId, profileId, weekStart],
  );

  return {
    weekStart,
    targetMinutes: row.target_minutes,
    coinsPerMember: row.coins_per_member,
    currentMinutes,
    completedAt: row.completed_at,
    claimedAt: claimed.rows[0]?.claimed_at ?? null,
    contributedMinutes: Number(userContrib.rows[0]?.minutes ?? 0),
  };
}

/**
 * Auto-credit coins to every current group member who contributed at least one
 * minute in the given week. Idempotent via the unique claims constraint.
 */
async function creditWeeklyQuestContributors(
  groupId: number,
  weekStart: string,
  coinsPerMember: number,
): Promise<void> {
  const weekEnd = addDaysIso(weekStart, 7);

  const contributors = await pool.query<{ profile_id: string }>(
    `select distinct gfc.profile_id
     from group_focus_contributions gfc
     join group_members gm on gm.group_id = gfc.group_id and gm.profile_id = gfc.profile_id
     where gfc.group_id = $1
       and gfc.contributed_at >= ($2::date)::timestamp at time zone 'America/Sao_Paulo'
       and gfc.contributed_at < ($3::date)::timestamp at time zone 'America/Sao_Paulo'`,
    [groupId, weekStart, weekEnd],
  );

  for (const { profile_id } of contributors.rows) {
    const inserted = await pool.query(
      `insert into group_weekly_quest_claims (group_id, profile_id, week_start, coins_awarded)
       values ($1, $2, $3, $4)
       on conflict (group_id, profile_id, week_start) do nothing
       returning id`,
      [groupId, profile_id, weekStart, coinsPerMember],
    );
    if (inserted.rows[0]) await addCoins(profile_id, coinsPerMember);
  }
}
