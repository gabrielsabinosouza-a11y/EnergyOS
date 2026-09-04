import pool from "../db";
import type { Pool, PoolClient } from "pg";
import type { UserXP } from "@/types";
import { parseProfileId } from "./validation";
import { recordMissionProgress } from "./daily-quests";
import { addCoins } from "./settings";
import { addLeagueXP } from "./league-new";
import { calculateXPWithBoost } from "./xp-boost";

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

/**
 * Single write path for XP: ledger + lifetime total + weekly league board.
 * Every XP award routes through here, so the 2x boost multiplier is applied
 * here — guaranteeing the boost applies to ALL XP sources consistently.
 *
 * Callers that already wrote the ledger (e.g. inside a transaction) should
 * only call `addLeagueXP` after commit.
 *
 * Returns the final (boost-adjusted) XP amount actually credited.
 */
export async function creditXP(
  profileId: string,
  source: string,
  sourceId: number | string,
  xp: number,
  options?: { recordMission?: boolean; questDate?: string; db?: Pool | PoolClient },
): Promise<number> {
  parseProfileId(profileId);
  if (!Number.isFinite(xp) || xp <= 0) return 0;

  const finalXP = await calculateXPWithBoost(profileId, xp);
  if (!Number.isFinite(finalXP) || finalXP <= 0) return 0;

  const db = options?.db ?? pool;
  const sourceKey = String(sourceId ?? "");
  // The ledger has a unique index on (profile_id, source, coalesce(source_id,'')).
  // ON CONFLICT DO NOTHING makes every award idempotent: a duplicate insert
  // (double-submit, race, replay) returns no row and nothing else is credited.
  const ledger = await db.query(
    `insert into xp_ledger (profile_id, source, source_id, xp_amount)
     values ($1, $2, $3, $4)
     on conflict (profile_id, source, coalesce(source_id, '')) do nothing
     returning id`,
    [profileId, source, sourceKey, finalXP],
  );
  if (!ledger.rows[0]) return 0;

  await db.query(
    `insert into user_xp (profile_id, total_xp, level, updated_at)
     values ($1, $2, 1, now())
     on conflict (profile_id) do update set total_xp = user_xp.total_xp + $2, updated_at = now()`,
    [profileId, finalXP],
  );
  if (options?.recordMission !== false) {
    await recordMissionProgress(profileId, "XP_EARNED", {
      incrementBy: finalXP,
      questDate: options?.questDate,
      ...(options?.db ? { client: options.db } : {}),
    });
  }
  // When running inside a caller-owned transaction (options.db), the league
  // board is deferred to the caller — addLeagueXP touches its own tables and
  // connections and cannot join this transaction. See also the docstring below.
  if (!options?.db) {
    await addLeagueXP(profileId, finalXP);
  }
  return finalXP;
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
    await creditXP(profileId, source, sourceId, xp);
  }
  if (coins > 0) {
    await addCoins(profileId, coins);
  }
}

export async function awardTaskXP(profileId: string, taskId: number, xp: number): Promise<void> {
  await creditXP(profileId, "task", taskId, xp);
}

export async function awardKanbanXP(
  profileId: string,
  kanbanTaskId: number,
  baseXP = 15,
  db?: Pool | PoolClient,
): Promise<number> {
  parseProfileId(profileId);
  // creditXP is idempotent (unique ledger row per source_id), so the extra
  // existence check is only a fast path.
  return creditXP(profileId, "kanban_task", kanbanTaskId, baseXP, db ? { db } : undefined);
}

export async function awardStreakBonus(profileId: string, streakDays: number): Promise<number> {
  parseProfileId(profileId);
  if (streakDays < 7 || streakDays % 7 !== 0) return 0;

  return creditXP(profileId, "streak_bonus", String(streakDays), 10);
}
