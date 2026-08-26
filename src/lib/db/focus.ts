import pool from "../db";
import type { FocusSession } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseProfileId } from "./validation";
import { todayIso } from "./dates";

function calculateCoins(durationMinutes: number): number {
  if (durationMinutes < 10) return 0;
  if (durationMinutes <= 60) {
    return Math.round(9 + 16 * ((durationMinutes - 10) / 50));
  }
  return Math.round(25 + 25 * ((Math.min(durationMinutes, 120) - 60) / 60));
}

interface FocusRow {
  id: string | number;
  profile_id: string;
  duration_minutes: number;
  target_duration_minutes: number;
  started_at: Date | string;
  ended_at: Date | string | null;
  task_id: string | number | null;
  xp_earned: number;
}

function mapFocus(row: FocusRow): FocusSession {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    durationMinutes: row.duration_minutes,
    targetDurationMinutes: row.target_duration_minutes ?? 25,
    startedAt: typeof row.started_at === "string" ? row.started_at : row.started_at.toISOString(),
    endedAt: row.ended_at ? (typeof row.ended_at === "string" ? row.ended_at : row.ended_at.toISOString()) : undefined,
    taskId: row.task_id ? Number(row.task_id) : undefined,
    xpEarned: row.xp_earned,
  };
}

export async function startFocusSession(profileId: string, targetDurationMinutes: number, taskId?: number): Promise<FocusSession> {
  parseProfileId(profileId);
  if (!Number.isInteger(targetDurationMinutes) || targetDurationMinutes < 1 || targetDurationMinutes > 240) {
    throw new ValidationError("Duração inválida.");
  }
  const result = await pool.query<FocusRow>(
    `insert into focus_sessions (profile_id, task_id, duration_minutes, target_duration_minutes) values ($1, $2, 0, $3)
     returning id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned`,
    [profileId, taskId ?? null, targetDurationMinutes],
  );
  return mapFocus(result.rows[0]);
}

export async function endFocusSession(profileId: string, sessionId: number, focusedSeconds: number): Promise<{ session: FocusSession; xpAwarded: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) throw new ValidationError("Sessão inválida.");
  if (!Number.isFinite(focusedSeconds) || focusedSeconds < 0) throw new ValidationError("Duração inválida.");

  const session = await pool.query<FocusRow>(
    `select id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned
     from focus_sessions where profile_id = $1 and id = $2`,
    [profileId, sessionId],
  );
  if (!session.rows[0]) throw new NotFoundError("Sessão não encontrada.");
  if (session.rows[0].ended_at) throw new ValidationError("Sessão já finalizada.");

  const durationMinutes = Math.max(1, Math.round(focusedSeconds / 60));
  const xpAwarded = calculateCoins(durationMinutes);

  const updated = await pool.query<FocusRow>(
    `update focus_sessions set duration_minutes = $3, ended_at = now(), xp_earned = $4
     where profile_id = $1 and id = $2
     returning id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned`,
    [profileId, sessionId, durationMinutes, xpAwarded],
  );

  if (xpAwarded > 0) {
    await pool.query(
      `insert into xp_ledger (profile_id, source, source_id, xp_amount) values ($1, 'focus', $2, $3)`,
      [profileId, sessionId, xpAwarded],
    );
    await pool.query(
      `insert into user_xp (profile_id, total_xp, level, updated_at)
       values ($1, $3, 1, now())
       on conflict (profile_id) do update set total_xp = user_xp.total_xp + $3, updated_at = now()`,
      [profileId, xpAwarded],
    );
  }

  return { session: mapFocus(updated.rows[0]), xpAwarded };
}

export async function getFocusHistory(profileId: string): Promise<FocusSession[]> {
  parseProfileId(profileId);
  const result = await pool.query<FocusRow>(
    `select id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at, task_id, xp_earned
     from focus_sessions where profile_id = $1 and ended_at is not null
     order by started_at desc limit 30`,
    [profileId],
  );
  return result.rows.map(mapFocus);
}

export async function getTodayFocusStats(profileId: string): Promise<{ minutesFocused: number; coinsEarned: number }> {
  parseProfileId(profileId);
  const today = todayIso();
  const result = await pool.query<{ minutes: string | number; coins: string | number }>(
    `select coalesce(sum(duration_minutes), 0) as minutes,
            coalesce(sum(xp_earned), 0) as coins
     from focus_sessions where profile_id = $1 and ended_at is not null and started_at::date = $2::date`,
    [profileId, today],
  );
  return { minutesFocused: Number(result.rows[0]?.minutes ?? 0), coinsEarned: Number(result.rows[0]?.coins ?? 0) };
}
