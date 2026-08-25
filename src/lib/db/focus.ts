import pool from "../db";
import type { FocusSession } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseProfileId } from "./validation";
import { todayIso } from "./dates";

const XP_PER_FOCUS_BLOCK = 5;
const MAX_FOCUS_BLOCKS_PER_DAY = 8;
const FOCUS_BLOCK_MINUTES = 25;

interface FocusRow {
  id: string | number;
  profile_id: string;
  duration_minutes: number;
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
    startedAt: typeof row.started_at === "string" ? row.started_at : row.started_at.toISOString(),
    endedAt: row.ended_at ? (typeof row.ended_at === "string" ? row.ended_at : row.ended_at.toISOString()) : undefined,
    taskId: row.task_id ? Number(row.task_id) : undefined,
    xpEarned: row.xp_earned,
  };
}

export async function startFocusSession(profileId: string, taskId?: number): Promise<FocusSession> {
  parseProfileId(profileId);
  const result = await pool.query<FocusRow>(
    `insert into focus_sessions (profile_id, task_id) values ($1, $2)
     returning id, profile_id, duration_minutes, started_at, ended_at, task_id, xp_earned`,
    [profileId, taskId ?? null],
  );
  return mapFocus(result.rows[0]);
}

export async function endFocusSession(profileId: string, sessionId: number): Promise<{ session: FocusSession; xpAwarded: number }> {
  parseProfileId(profileId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) throw new ValidationError("Sessão inválida.");

  const session = await pool.query<FocusRow>(
    `select id, profile_id, duration_minutes, started_at, ended_at, task_id, xp_earned
     from focus_sessions where profile_id = $1 and id = $2`,
    [profileId, sessionId],
  );
  if (!session.rows[0]) throw new NotFoundError("Sessão não encontrada.");
  if (session.rows[0].ended_at) throw new ValidationError("Sessão já finalizada.");

  const endedAt = new Date();
  const startedAt = new Date(session.rows[0].started_at);
  const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));

  const today = todayIso();
  const todaySessions = await pool.query<{ blocks: string | number }>(
    `select coalesce(sum( CASE WHEN duration_minutes >= $3 THEN LEAST(duration_minutes / $3, 1) ELSE 0 END ), 0) as blocks
     from focus_sessions where profile_id = $1 and ended_at is not null and started_at::date = $2::date and id != $4`,
    [profileId, today, FOCUS_BLOCK_MINUTES, sessionId],
  );
  const existingBlocks = Number(todaySessions.rows[0]?.blocks ?? 0);
  const newBlocks = Math.min(Math.floor(durationMinutes / FOCUS_BLOCK_MINUTES), MAX_FOCUS_BLOCKS_PER_DAY - existingBlocks);
  const xpAwarded = Math.max(0, newBlocks * XP_PER_FOCUS_BLOCK);

  const updated = await pool.query<FocusRow>(
    `update focus_sessions set duration_minutes = $3, ended_at = $4, xp_earned = $5
     where profile_id = $1 and id = $2
     returning id, profile_id, duration_minutes, started_at, ended_at, task_id, xp_earned`,
    [profileId, sessionId, durationMinutes, endedAt.toISOString(), xpAwarded],
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
    `select id, profile_id, duration_minutes, started_at, ended_at, task_id, xp_earned
     from focus_sessions where profile_id = $1 and ended_at is not null
     order by started_at desc limit 30`,
    [profileId],
  );
  return result.rows.map(mapFocus);
}

export async function getTodayFocusBlocks(profileId: string): Promise<{ blocks: number; xpEarned: number }> {
  parseProfileId(profileId);
  const today = todayIso();
  const result = await pool.query<{ blocks: string | number; xp: string | number }>(
    `select coalesce(sum(CASE WHEN duration_minutes >= $2 THEN LEAST(duration_minutes / $2, 1) ELSE 0 END), 0) as blocks,
            coalesce(sum(xp_earned), 0) as xp
     from focus_sessions where profile_id = $1 and ended_at is not null and started_at::date = $3::date`,
    [profileId, FOCUS_BLOCK_MINUTES, today],
  );
  return { blocks: Number(result.rows[0]?.blocks ?? 0), xpEarned: Number(result.rows[0]?.xp ?? 0) };
}
