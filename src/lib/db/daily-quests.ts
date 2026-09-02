import type { PoolClient } from "pg";
import pool from "../db";
import type { DailyQuest, UserQuestProgress, QuestProgressWithQuest, QuestType, MissionMetric } from "@/types";
import { parseProfileId, ValidationError } from "./validation";
import { addCoins } from "./settings";
import { addDaysIso, todayIso } from "./dates";
import { addLeagueXP } from "./league-new";
import { ConflictError, NotFoundError } from "../errors";
import { DAILY_MISSION_LIMIT } from "../daily-limits";

// Re-export for server callers
export { DAILY_MISSION_LIMIT };

// ========================================
// Quest Definitions (mission pool)
// ========================================

interface MissionSeed {
  title: string;
  description: string;
  metric: MissionMetric;
  type: QuestType;
  targetValue: number;
  coinReward: number;
}

// The complete pool of daily missions. Each user is randomly assigned exactly
// DAILY_MISSION_LIMIT of these per day. Only missions with a trackable metric
// are included — anything that can't be measured from current data is omitted
// (see the flagged list in the codebase notes).
const DEFAULT_DAILY_QUESTS: MissionSeed[] = [
  { title: "Complete 1 sessão de foco", description: "Conclua 1 sessão de foco hoje", metric: "SESSIONS_COMPLETED", type: "SESSIONS_COUNT", targetValue: 1, coinReward: 10 },
  { title: "Complete 2 sessões de foco", description: "Conclua 2 sessões de foco hoje", metric: "SESSIONS_COMPLETED", type: "SESSIONS_COUNT", targetValue: 2, coinReward: 10 },
  { title: "Complete 3 sessões de foco", description: "Conclua 3 sessões de foco hoje", metric: "SESSIONS_COMPLETED", type: "SESSIONS_COUNT", targetValue: 3, coinReward: 15 },
  { title: "Foque 30 minutos hoje", description: "Acumule 30 minutos de foco hoje", metric: "TOTAL_MINUTES", type: "TOTAL_MINUTES", targetValue: 30, coinReward: 10 },
  { title: "Foque 60 minutos hoje", description: "Acumule 60 minutos de foco hoje", metric: "TOTAL_MINUTES", type: "TOTAL_MINUTES", targetValue: 60, coinReward: 10 },
  { title: "Foque 90 minutos hoje", description: "Acumule 90 minutos de foco hoje", metric: "TOTAL_MINUTES", type: "TOTAL_MINUTES", targetValue: 90, coinReward: 15 },
  { title: "Participe de uma Sala de Foco", description: "Participe de uma sessão em uma Sala de Foco", metric: "ROOM_SESSION_COMPLETED", type: "ROOM_SESSION", targetValue: 1, coinReward: 20 },
  { title: "Participe de 2 salas diferentes", description: "Participe de sessões em 2 salas de foco diferentes", metric: "DISTINCT_ROOMS", type: "ROOM_SESSION", targetValue: 2, coinReward: 15 },
  { title: "Complete 3 tarefas hoje", description: "Conclua 3 tarefas hoje", metric: "TASKS_COMPLETED", type: "SESSIONS_COUNT", targetValue: 3, coinReward: 10 },
  { title: "Mantenha seu streak por mais um dia", description: "Atinja a qualificação diária de streak hoje", metric: "STREAK_DAY", type: "SESSIONS_COUNT", targetValue: 1, coinReward: 15 },
  { title: "Complete uma sessão de 60+ minutos", description: "Conclua uma única sessão de foco com 60 minutos ou mais", metric: "LONG_SESSION_60", type: "SESSIONS_COUNT", targetValue: 1, coinReward: 20 },
  { title: "Complete 3 hábitos hoje", description: "Conclua 3 hábitos diferentes hoje", metric: "HABITS_COMPLETED", type: "SESSIONS_COUNT", targetValue: 3, coinReward: 10 },
  { title: "Foque antes das 9h", description: "Complete uma sessão de foco iniciada antes das 9h", metric: "EARLY_SESSION_9AM", type: "SESSIONS_COUNT", targetValue: 1, coinReward: 15 },
  { title: "Complete uma missão da semana", description: "Conclua uma missão do seu plano da semana", metric: "WEEKLY_PLAN_COMPLETED", type: "SESSIONS_COUNT", targetValue: 1, coinReward: 15 },
  { title: "Ganhe 50 XP hoje", description: "Acumule 50 pontos de XP hoje", metric: "XP_EARNED", type: "SESSIONS_COUNT", targetValue: 50, coinReward: 20 },
];

// ========================================
// Row Interfaces
// ========================================

interface DailyQuestRow {
  id: string | number;
  title: string;
  description: string;
  type: QuestType | null;
  metric: string | null;
  target_value: number;
  coin_reward: number;
  is_active: boolean;
  created_at: Date | string;
}

interface UserQuestProgressRow {
  id: string | number;
  profile_id: string;
  quest_id: string | number;
  quest_date: Date | string;
  current_value: number;
  is_completed: boolean;
  is_claimed: boolean;
  completed_at: Date | string | null;
  claimed_at: Date | string | null;
  created_at: Date | string;
}

// ========================================
// Mapping Functions
// ========================================

function mapDailyQuest(row: DailyQuestRow): DailyQuest {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    type: row.type,
    metric: row.metric,
    targetValue: row.target_value,
    coinReward: row.coin_reward,
    isActive: row.is_active,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

function mapUserQuestProgress(row: UserQuestProgressRow): UserQuestProgress {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    questId: Number(row.quest_id),
    questDate: typeof row.quest_date === "string" ? row.quest_date : row.quest_date.toISOString().slice(0, 10),
    currentValue: row.current_value,
    isCompleted: row.is_completed,
    isClaimed: row.is_claimed,
    completedAt: row.completed_at ? (typeof row.completed_at === "string" ? row.completed_at : row.completed_at.toISOString()) : undefined,
    claimedAt: row.claimed_at ? (typeof row.claimed_at === "string" ? row.claimed_at : row.claimed_at.toISOString()) : undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

// ========================================
// Quest Management
// ========================================

export async function listDailyQuests(): Promise<DailyQuest[]> {
  const result = await pool.query<DailyQuestRow>(
    `select id, title, description, type, metric, target_value, coin_reward, is_active, created_at from daily_quests where is_active = true order by id`,
  );
  return result.rows.map(mapDailyQuest);
}

export async function getDailyQuest(questId: number): Promise<DailyQuest | null> {
  const result = await pool.query<DailyQuestRow>(
    `select id, title, description, type, metric, target_value, coin_reward, is_active, created_at from daily_quests where id = $1`,
    [questId],
  );
  return result.rows[0] ? mapDailyQuest(result.rows[0]) : null;
}

// ========================================
// User Quest Progress
// ========================================

export async function getUserQuestProgress(
  profileId: string,
  questDate: string,
): Promise<UserQuestProgress[]> {
  parseProfileId(profileId);
  const result = await pool.query<UserQuestProgressRow>(
    `select 
      uqp.id, uqp.profile_id, uqp.quest_id, uqp.quest_date, uqp.current_value, 
      uqp.is_completed, uqp.is_claimed, uqp.completed_at, uqp.claimed_at, uqp.created_at
     from user_quest_progress uqp 
     where uqp.profile_id = $1 and uqp.quest_date = $2
     order by uqp.quest_id`,
    [profileId, questDate],
  );
  return result.rows.map(mapUserQuestProgress);
}

export async function getUserQuestProgressWithQuests(
  profileId: string,
  questDate: string,
): Promise<QuestProgressWithQuest[]> {
  parseProfileId(profileId);
  const result = await pool.query<{
    uqp_id: string | number;
    uqp_profile_id: string;
    uqp_quest_id: string | number;
    uqp_quest_date: Date | string;
    uqp_current_value: number;
    uqp_is_completed: boolean;
    uqp_is_claimed: boolean;
    uqp_completed_at: Date | string | null;
    uqp_claimed_at: Date | string | null;
    uqp_created_at: Date | string;
    q_id: string | number;
    q_title: string;
    q_description: string;
    q_type: QuestType | null;
    q_metric: string | null;
    q_target_value: number;
    q_coin_reward: number;
    q_is_active: boolean;
    q_created_at: Date | string;
  }>(
    `select 
      uqp.id as uqp_id, uqp.profile_id as uqp_profile_id, uqp.quest_id as uqp_quest_id, 
      uqp.quest_date as uqp_quest_date, uqp.current_value as uqp_current_value,
      uqp.is_completed as uqp_is_completed, uqp.is_claimed as uqp_is_claimed,
      uqp.completed_at as uqp_completed_at, uqp.claimed_at as uqp_claimed_at,
      uqp.created_at as uqp_created_at,
      q.id as q_id, q.title as q_title, q.description as q_description,
      q.type as q_type, q.metric as q_metric, q.target_value as q_target_value,
      q.coin_reward as q_coin_reward, q.is_active as q_is_active,
      q.created_at as q_created_at
     from user_quest_progress uqp
     join daily_quests q on uqp.quest_id = q.id
     where uqp.profile_id = $1 and uqp.quest_date = $2
     order by q.id`,
    [profileId, questDate],
  );
  return result.rows.map((row) => ({
    ...mapUserQuestProgress({
      id: row.uqp_id,
      profile_id: row.uqp_profile_id,
      quest_id: row.uqp_quest_id,
      quest_date: row.uqp_quest_date,
      current_value: row.uqp_current_value,
      is_completed: row.uqp_is_completed,
      is_claimed: row.uqp_is_claimed,
      completed_at: row.uqp_completed_at,
      claimed_at: row.uqp_claimed_at,
      created_at: row.uqp_created_at,
    }),
    quest: mapDailyQuest({
      id: row.q_id,
      title: row.q_title,
      description: row.q_description,
      type: row.q_type,
      metric: row.q_metric,
      target_value: row.q_target_value,
      coin_reward: row.q_coin_reward,
      is_active: row.q_is_active,
      created_at: row.q_created_at,
    }),
  }));
}

// ========================================
// Quest Generation & Initialization
// ========================================

export async function ensureDailyQuestsExist(): Promise<void> {
  const existing = await pool.query<{ count: string }>(
    `select count(*)::int as count from daily_quests where is_active = true`,
  );

  // Only seed if the pool is not populated yet (fresh installs).
  if (Number(existing.rows[0]?.count || 0) === 0) {
    for (const quest of DEFAULT_DAILY_QUESTS) {
      await pool.query(
        `insert into daily_quests (title, description, type, metric, target_value, coin_reward, is_active)
         values ($1, $2, $3::quest_type, $4, $5, $6, true)
         on conflict (title) do update set metric = excluded.metric, description = excluded.description,
           target_value = excluded.target_value, coin_reward = excluded.coin_reward, is_active = true`,
        [quest.title, quest.description, quest.type, quest.metric, quest.targetValue, quest.coinReward],
      );
    }
  }
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Deterministic shuffle — same user gets the same mission order on a given date. */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const copy = [...array];
  let state = hashSeed(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Assigns exactly `DAILY_MISSION_LIMIT` random active missions to the user for
// the given date (creating any missing rows). Picks replace the previous set:
// mission set from yesterday is avoided when there are enough other missions.
export async function initializeUserDailyQuests(
  profileId: string,
  questDate: string,
): Promise<UserQuestProgress[]> {
  parseProfileId(profileId);

  // First, ensure the mission pool exists
  await ensureDailyQuestsExist();

  // All active missions in the pool
  const quests = await listDailyQuests();

  // Check which missions the user already has for this date
  let existing = await getUserQuestProgress(profileId, questDate);

  // Legacy rows: if a user somehow has more than the daily limit, reset today's set.
  if (existing.length > DAILY_MISSION_LIMIT) {
    await pool.query(
      `delete from user_quest_progress where profile_id = $1 and quest_date = $2`,
      [profileId, questDate],
    );
    existing = [];
  }

  const existingQuestIds = new Set(existing.map((p) => p.questId));

  // Already fully assigned for today
  if (existing.length === DAILY_MISSION_LIMIT) {
    return existing;
  }

  // Yesterday's missions, to avoid repeating the exact same set today.
  const yesterday = addDaysIso(questDate, -1);
  const yesterdayProgress = await getUserQuestProgress(profileId, yesterday);
  const yesterdayIds = new Set(yesterdayProgress.map((p) => p.questId));

  const notAssigned = quests.filter((q) => !existingQuestIds.has(q.id));
  // Prefer candidates that were NOT assigned yesterday, but fall back to all
  // available missions if that leaves fewer than we need for a varied set.
  const candidates = notAssigned.filter((q) => !yesterdayIds.has(q.id));
  const poolForPick = candidates.length >= DAILY_MISSION_LIMIT ? candidates : notAssigned;

  const need = DAILY_MISSION_LIMIT - existing.length;
  const pick = seededShuffle(poolForPick, `${profileId}:${questDate}`).slice(0, need);

  const created: UserQuestProgress[] = [];
  for (const quest of pick) {
    const result = await pool.query<UserQuestProgressRow>(
      `insert into user_quest_progress (profile_id, quest_id, quest_date, current_value, is_completed, is_claimed)
       values ($1, $2, $3, 0, false, false)
       returning id, profile_id, quest_id, quest_date, current_value, is_completed, is_claimed, completed_at, claimed_at, created_at`,
      [profileId, quest.id, questDate],
    );
    if (result.rows[0]) {
      created.push(mapUserQuestProgress(result.rows[0]));
    }
  }

  return [...existing, ...created];
}

// ========================================
// Quest Progress Updates
// ========================================

export interface RecordMissionProgressOptions {
  questDate?: string;
  incrementBy?: number;
  /** When provided, sets current_value to this exact value instead of incrementing (used for count-of-distinct-events metrics like DISTINCT_ROOMS). */
  setTo?: number;
  client?: PoolClient;
}

/**
 * Advances progress for every mission assigned to the user whose metric
 * matches. This is the single shared hook that all daily event sites call —
 * it replaces the old hardcoded quest-id increments so missions are advanced
 * regardless of the actual daily_quests row ids.
 */
export async function recordMissionProgress(
  profileId: string,
  metric: string,
  options: RecordMissionProgressOptions = {},
): Promise<void> {
  parseProfileId(profileId);

  const questDate = options.questDate ?? todayIso();

  // Make sure today's missions are assigned before recording progress.
  await initializeUserDailyQuests(profileId, questDate);

  let query: string;
  let params: (string | number)[];

  if (options.setTo !== undefined) {
    query = `
      update user_quest_progress uqp
      set current_value = $4,
          is_completed = uqp.is_completed or $4 >= q.target_value,
          completed_at = case
            when $4 >= q.target_value and uqp.completed_at is null then now()
            else uqp.completed_at
          end
      from daily_quests q
      where q.id = uqp.quest_id
        and q.is_active = true
        and q.metric = $1
        and uqp.profile_id = $2 and uqp.quest_date = $3
    `;
    params = [metric, profileId, questDate, options.setTo];
  } else {
    const amount = options.incrementBy ?? 1;
    query = `
      update user_quest_progress uqp
      set current_value = uqp.current_value + $4,
          is_completed = uqp.is_completed or (uqp.current_value + $4) >= q.target_value,
          completed_at = case
            when (uqp.current_value + $4) >= q.target_value and uqp.completed_at is null then now()
            else uqp.completed_at
          end
      from daily_quests q
      where q.id = uqp.quest_id
        and q.is_active = true
        and q.metric = $1
        and uqp.profile_id = $2 and uqp.quest_date = $3
    `;
    params = [metric, profileId, questDate, amount];
  }

  if (options.client) {
    await options.client.query(query, params);
  } else {
    await pool.query(query, params);
  }
}

export interface UpdateQuestProgressInput {
  questId: number;
  questDate: string;
  incrementBy?: number;
  setCompleted?: boolean;
  markClaimed?: boolean;
}

export async function updateQuestProgress(
  profileId: string,
  input: UpdateQuestProgressInput,
): Promise<UserQuestProgress> {
  parseProfileId(profileId);
  
  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [profileId, input.questId, input.questDate];
  
  // Build update query
  if (input.incrementBy !== undefined) {
    values.push(input.incrementBy);
    updates.push(`current_value = current_value + $${values.length}`);
  }
  if (input.setCompleted !== undefined) {
    values.push(input.setCompleted);
    updates.push(`is_completed = $${values.length}`);
    if (input.setCompleted) {
      updates.push(`completed_at = now()`);
    }
  }
  if (input.markClaimed !== undefined) {
    values.push(input.markClaimed);
    updates.push(`is_claimed = $${values.length}`);
    if (input.markClaimed) {
      updates.push(`claimed_at = now()`);
    }
  }
  
  if (updates.length === 0) {
    throw new ValidationError("No updates provided");
  }
  
  const result = await pool.query<UserQuestProgressRow>(
    `update user_quest_progress 
     set ${updates.join(", ")}
     where profile_id = $1 and quest_id = $2 and quest_date = $3
     returning id, profile_id, quest_id, quest_date, current_value, is_completed, is_claimed, completed_at, claimed_at, created_at`,
    values,
  );
  
  if (!result.rows[0]) {
    throw new NotFoundError("Quest progress not found");
  }
  
  return mapUserQuestProgress(result.rows[0]);
}

export async function incrementQuestProgress(
  profileId: string,
  questId: number,
  questDate: string,
  amount: number = 1,
): Promise<UserQuestProgress> {
  parseProfileId(profileId);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new ValidationError("Invalid increment amount");
  }

  // Single atomic UPDATE: increment and evaluate completion against the target
  // in one statement, so concurrent increments can never leave a quest at
  // current_value >= target_value with is_completed = false.
  const result = await pool.query<UserQuestProgressRow>(
    `update user_quest_progress uqp
     set current_value = uqp.current_value + $4,
         is_completed = uqp.is_completed or (uqp.current_value + $4) >= q.target_value,
         completed_at = case
           when (uqp.current_value + $4) >= q.target_value and uqp.completed_at is null then now()
           else uqp.completed_at
         end
     from daily_quests q
     where q.id = uqp.quest_id
       and uqp.profile_id = $1 and uqp.quest_id = $2 and uqp.quest_date = $3
     returning uqp.id, uqp.profile_id, uqp.quest_id, uqp.quest_date, uqp.current_value,
               uqp.is_completed, uqp.is_claimed, uqp.completed_at, uqp.claimed_at, uqp.created_at`,
    [profileId, questId, questDate, amount],
  );

  if (!result.rows[0]) {
    throw new NotFoundError("Quest progress not found");
  }

  return mapUserQuestProgress(result.rows[0]);
}

// ========================================
// Coin Claiming
// ========================================

export async function claimQuestReward(
  profileId: string,
  questProgressId: number,
): Promise<{ coinsAwarded: number; quest: DailyQuest }> {
  parseProfileId(profileId);

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Get the quest progress with quest details (lock the row for the transaction)
    const result = await client.query<{
      uqp_profile_id: string;
      uqp_quest_id: string | number;
      uqp_quest_date: string;
      uqp_current_value: number;
      uqp_is_completed: boolean;
      uqp_is_claimed: boolean;
      q_title: string;
      q_description: string;
      q_type: QuestType;
      q_target_value: number;
      q_coin_reward: number;
    }>(
      `select 
        uqp.profile_id as uqp_profile_id, uqp.quest_id as uqp_quest_id, uqp.quest_date as uqp_quest_date,
        uqp.current_value as uqp_current_value, uqp.is_completed as uqp_is_completed, uqp.is_claimed as uqp_is_claimed,
        q.title as q_title, q.description as q_description, q.type as q_type,
        q.target_value as q_target_value, q.coin_reward as q_coin_reward
       from user_quest_progress uqp
       join daily_quests q on uqp.quest_id = q.id
       where uqp.id = $1 and uqp.profile_id = $2
       for update of uqp`,
      [questProgressId, profileId],
    );

    if (!result.rows[0]) {
      throw new NotFoundError("Missão não encontrada.");
    }

    const row = result.rows[0];

    if (row.uqp_is_claimed) {
      throw new ConflictError("Recompensa já resgatada.");
    }

    // Self-heal: treat as complete if the value threshold was met even if the
    // is_completed flag was never set (e.g. stale data or a previous race).
    const isComplete = row.uqp_is_completed || row.uqp_current_value >= row.q_target_value;

    if (!isComplete) {
      throw new ConflictError("Missão ainda não concluída.");
    }

    // Mark as claimed + ensure completed in the same step
    await client.query(
      `update user_quest_progress 
       set is_claimed = true, claimed_at = now(),
           is_completed = true,
           completed_at = case when completed_at is null then now() else completed_at end
       where id = $1`,
      [questProgressId],
    );

    // Award coins to user using the helper function (upserts settings row)
    await addCoins(profileId, row.q_coin_reward, client);

    // Add to XP ledger for tracking
    await client.query(
      `insert into xp_ledger (profile_id, source, source_id, xp_amount)
       values ($1, 'daily_quest', $2, $3)`,
      [profileId, questProgressId, row.q_coin_reward],
    );

    // Credit the same amount to the user's cumulative XP (leaderboard/level).
    await client.query(
      `insert into user_xp (profile_id, total_xp, level, updated_at)
       values ($1, $2, 1, now())
       on conflict (profile_id) do update set total_xp = user_xp.total_xp + $2, updated_at = now()`,
      [profileId, row.q_coin_reward],
    );

    await client.query("commit");

    // Claiming also awards XP (recorded in the ledger), which feeds the
    // "Earn N XP today" mission and the weekly league board.
    await recordMissionProgress(profileId, "XP_EARNED", { incrementBy: row.q_coin_reward });
    await addLeagueXP(profileId, row.q_coin_reward);

    const quest: DailyQuest = {
      id: Number(row.uqp_quest_id),
      title: row.q_title,
      description: row.q_description,
      type: row.q_type,
      targetValue: row.q_target_value,
      coinReward: row.q_coin_reward,
      isActive: true,
      createdAt: "",
    };

    return { coinsAwarded: row.q_coin_reward, quest };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
