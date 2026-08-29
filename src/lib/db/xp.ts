import pool from "../db";
import type { UserXP } from "@/types";
import { parseProfileId } from "./validation";
import { recordMissionProgress } from "./daily-quests";
import { addCoins } from "./settings";

interface XPRow {
  profile_id: string;
  total_xp: string | number;
  level: string | number;
}

function mapXP(row: XPRow): UserXP {
  return {
    profileId: row.profile_id,
    totalXP: Number(row.total_xp),
    level: Number(row.level),
  };
}

export async function getUserXP(profileId: string): Promise<UserXP> {
  parseProfileId(profileId);
  const result = await pool.query<XPRow>(
    `select profile_id, total_xp, level from user_xp where profile_id = $1`,
    [profileId],
  );
  if (!result.rows[0]) return { profileId, totalXP: 0, level: 1 };
  return mapXP(result.rows[0]);
}

/** Acredita XP (leaderboard/level + ledger) e moedas de uma só vez, seguindo o padrão das tarefas diárias. */
export async function awardXPAndCoins(
  profileId: string,
  source: string,
  sourceId: number | string,
  xp: number,
  coins: number,
): Promise<void> {
  parseProfileId(profileId);
  if (xp <= 0 && coins <= 0) return;

  if (xp > 0) {
    await pool.query(
      `insert into xp_ledger (profile_id, source, source_id, xp_amount) values ($1, $2, $3, $4)`,
      [profileId, source, sourceId, xp],
    );
    await pool.query(
      `insert into user_xp (profile_id, total_xp, level, updated_at)
       values ($1, $2, 1, now())
       on conflict (profile_id) do update set total_xp = user_xp.total_xp + $2, updated_at = now()`,
      [profileId, xp],
    );
    await recordMissionProgress(profileId, "XP_EARNED", { incrementBy: xp });
  }
  if (coins > 0) {
    await addCoins(profileId, coins);
  }
}

export async function awardTaskXP(profileId: string, taskId: number, xp: number): Promise<void> {
  parseProfileId(profileId);
  if (xp <= 0) return;
  await pool.query(
    `insert into xp_ledger (profile_id, source, source_id, xp_amount) values ($1, 'task', $2, $3)`,
    [profileId, taskId, xp],
  );
  await pool.query(
    `insert into user_xp (profile_id, total_xp, level, updated_at)
     values ($1, $3, 1, now())
     on conflict (profile_id) do update set total_xp = user_xp.total_xp + $3, updated_at = now()`,
    [profileId, xp],
  );
  await recordMissionProgress(profileId, "XP_EARNED", { incrementBy: xp });
}

export async function awardKanbanXP(profileId: string, kanbanTaskId: number): Promise<number> {
  parseProfileId(profileId);
  const existing = await pool.query(
    `select 1 from xp_ledger where profile_id = $1 and source = 'kanban' and source_id = $2`,
    [profileId, kanbanTaskId],
  );
  if (existing.rows[0]) return 0;

  const xp = 15;
  await pool.query(
    `insert into xp_ledger (profile_id, source, source_id, xp_amount) values ($1, 'kanban', $2, $3)`,
    [profileId, kanbanTaskId, xp],
  );
  await pool.query(
    `insert into user_xp (profile_id, total_xp, level, updated_at)
     values ($1, $3, 1, now())
     on conflict (profile_id) do update set total_xp = user_xp.total_xp + $3, updated_at = now()`,
    [profileId, xp],
  );
  return xp;
}

export async function awardStreakBonus(profileId: string, streakDays: number): Promise<number> {
  parseProfileId(profileId);
  if (streakDays < 7 || streakDays % 7 !== 0) return 0;

  const existing = await pool.query(
    `select 1 from xp_ledger where profile_id = $1 and source = 'streak_bonus' and source_id = $2`,
    [profileId, streakDays],
  );
  if (existing.rows[0]) return 0;

  const xp = 10;
  await pool.query(
    `insert into xp_ledger (profile_id, source, source_id, xp_amount) values ($1, 'streak_bonus', $2, $3)`,
    [profileId, streakDays, xp],
  );
  await pool.query(
    `insert into user_xp (profile_id, total_xp, level, updated_at)
     values ($1, $3, 1, now())
     on conflict (profile_id) do update set total_xp = user_xp.total_xp + $3, updated_at = now()`,
    [profileId, xp],
  );
  return xp;
}
