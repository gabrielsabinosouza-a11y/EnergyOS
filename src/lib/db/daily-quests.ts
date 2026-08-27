import pool from "../db";
import type { DailyQuest, UserQuestProgress, QuestProgressWithQuest, QuestType } from "@/types";
import { parseProfileId } from "./validation";
import { addCoins } from "./settings";
import { ConflictError, NotFoundError } from "../errors";

// ========================================
// Quest Definitions
// ========================================

const DEFAULT_DAILY_QUESTS: Array<Omit<DailyQuest, "id" | "createdAt" | "isActive">> = [
  { title: "Complete 2 sessões hoje", description: "Conclua 2 sessões de foco hoje", type: "SESSIONS_COUNT", targetValue: 2, coinReward: 10 },
  { title: "Foque 90 minutos hoje", description: "Acumule 90 minutos de foco hoje", type: "TOTAL_MINUTES", targetValue: 90, coinReward: 15 },
  { title: "Foque em uma sala com amigos", description: "Participe de uma sessão em uma Sala de Foco", type: "ROOM_SESSION", targetValue: 1, coinReward: 20 },
];

const QUEST_TYPES: readonly QuestType[] = ["SESSIONS_COUNT", "TOTAL_MINUTES", "ROOM_SESSION"];

// ========================================
// Row Interfaces
// ========================================

interface DailyQuestRow {
  id: string | number;
  title: string;
  description: string;
  type: QuestType;
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
    `select id, title, description, type, target_value, coin_reward, is_active, created_at from daily_quests where is_active = true order by id`,
  );
  return result.rows.map(mapDailyQuest);
}

export async function getDailyQuest(questId: number): Promise<DailyQuest | null> {
  const result = await pool.query<DailyQuestRow>(
    `select id, title, description, type, target_value, coin_reward, is_active, created_at from daily_quests where id = $1`,
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
    q_type: QuestType;
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
      q.type as q_type, q.target_value as q_target_value,
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
    `select count(*)::int as count from daily_quests`,
  );
  
  if (Number(existing.rows[0]?.count || 0) === 0) {
    for (const quest of DEFAULT_DAILY_QUESTS) {
      await pool.query(
        `insert into daily_quests (title, description, type, target_value, coin_reward, is_active)
         values ($1, $2, $3, $4, $5, true)
         on conflict (title) do nothing`,
        [quest.title, quest.description, quest.type, quest.targetValue, quest.coinReward],
      );
    }
  }
}

export async function initializeUserDailyQuests(
  profileId: string,
  questDate: string,
): Promise<UserQuestProgress[]> {
  parseProfileId(profileId);
  
  // First, ensure daily quests exist
  await ensureDailyQuestsExist();
  
  // Get all active daily quests
  const quests = await listDailyQuests();
  
  // Check which quests the user already has for this date
  const existing = await getUserQuestProgress(profileId, questDate);
  const existingQuestIds = new Set(existing.map((p) => p.questId));
  
  // Create missing quests
  const created: UserQuestProgress[] = [];
  for (const quest of quests) {
    if (!existingQuestIds.has(quest.id)) {
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
  }
  
  return [...existing, ...created];
}

// ========================================
// Quest Progress Updates
// ========================================

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
    throw new Error("No updates provided");
  }
  
  const result = await pool.query<UserQuestProgressRow>(
    `update user_quest_progress 
     set ${updates.join(", ")}
     where profile_id = $1 and quest_id = $2 and quest_date = $3
     returning id, profile_id, quest_id, quest_date, current_value, is_completed, is_claimed, completed_at, claimed_at, created_at`,
    values,
  );
  
  if (!result.rows[0]) {
    throw new Error("Quest progress not found");
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
    throw new Error("Invalid increment amount");
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
    throw new Error("Quest progress not found");
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

    await client.query("commit");

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
