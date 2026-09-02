import pool from "../db";
import { addCoins } from "./settings";
import { getGroupTotalMinutes } from "./group-leaderboard";
import { weekStartIso, todayIso } from "./dates";
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
 * After every focus session, call this to unlock any newly crossed milestones
 * and award coins to all current members automatically.
 */
export async function checkAndUnlockMilestones(groupId: number): Promise<void> {
  const totalMinutes = await getGroupTotalMinutes(groupId, "ALL_TIME");

  for (const def of MILESTONE_DEFS) {
    if (totalMinutes < def.thresholdMinutes) continue;

    // Upsert the milestone unlock row (idempotent)
    const result = await pool.query<{ id: number; newly_inserted: boolean }>(
      `insert into group_activity_milestones (group_id, threshold_minutes, coins_per_member, badge_key)
       values ($1, $2, $3, $4)
       on conflict (group_id, threshold_minutes) do nothing
       returning id`,
      [groupId, def.thresholdMinutes, def.coinsPerMember, def.badgeKey],
    );

    if (!result.rows[0]) continue; // already existed — skip coin distribution

    // Award coins to every current member who hasn't claimed yet
    const members = await pool.query<{ profile_id: string }>(
      `select profile_id from group_members where group_id = $1`,
      [groupId],
    );

    for (const { profile_id } of members.rows) {
      const inserted = await pool.query(
        `insert into group_milestone_claims (group_id, profile_id, threshold_minutes, coins_awarded)
         values ($1, $2, $3, $4)
         on conflict (group_id, profile_id, threshold_minutes) do nothing
         returning id`,
        [groupId, profile_id, def.thresholdMinutes, def.coinsPerMember],
      );
      if (inserted.rows[0]) {
        await addCoins(profile_id, def.coinsPerMember);
      }
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
 * Claim the weekly quest reward. User must have contributed > 0 minutes
 * and the quest must be completed.
 */
export async function claimGroupWeeklyQuest(
  profileId: string,
  groupId: number,
): Promise<{ coinsAwarded: number }> {
  parseProfileId(profileId);

  const weekStart = weekStartIso(todayIso());

  const quest = await pool.query<{ completed_at: string | null; coins_per_member: number }>(
    `select completed_at, coins_per_member from group_weekly_quests
     where group_id = $1 and week_start = $2`,
    [groupId, weekStart],
  );
  if (!quest.rows[0]?.completed_at) throw new Error("Missão ainda não concluída.");

  const alreadyClaimed = await pool.query(
    `select 1 from group_weekly_quest_claims
     where group_id = $1 and profile_id = $2 and week_start = $3`,
    [groupId, profileId, weekStart],
  );
  if (alreadyClaimed.rows[0]) throw new Error("Recompensa já resgatada.");

  const contrib = await pool.query<{ minutes: number }>(
    `select coalesce(sum(minutes), 0)::int as minutes
     from group_focus_contributions
     where group_id = $1 and profile_id = $2
       and contributed_at >= ($3::date)::timestamptz`,
    [groupId, profileId, weekStart],
  );
  if (Number(contrib.rows[0]?.minutes ?? 0) === 0) {
    throw new Error("Você não contribuiu com foco esta semana.");
  }

  const coins = quest.rows[0].coins_per_member;
  await pool.query(
    `insert into group_weekly_quest_claims (group_id, profile_id, week_start, coins_awarded)
     values ($1, $2, $3, $4)`,
    [groupId, profileId, weekStart, coins],
  );
  await addCoins(profileId, coins);

  return { coinsAwarded: coins };
}
