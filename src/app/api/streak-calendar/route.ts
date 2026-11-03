import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk } from "@/lib/http";
import { computeStreak, getStreakCalendar, getStreakInfo } from "@/lib/db/tasks";
import { ValidationError } from "@/lib/db/validation";
import { todayIso, addDaysIso } from "@/lib/db/dates";
import pool from "@/lib/db";

/**
 * Check if streak data is stale (needs reconciliation).
 * A simple heuristic: if the last streak computation was today, we can skip recomputation.
 */
async function isStreakStale(profileId: string, today: string): Promise<boolean> {
  // Check if there are any focus sessions today that haven't been processed
  const sessionsRes = await pool.query<{ n: string }>(
    `select count(*)::int as n
       from focus_sessions
      where profile_id = $1
        and ended_at is not null
        and duration_minutes >= 1
        and (ended_at at time zone 'America/Sao_Paulo')::date = $2::date`,
    [profileId, today],
  );
  
  const todaySessions = Number(sessionsRes.rows[0]?.n ?? 0);
  
  if (todaySessions === 0) {
    // No sessions today, check if streak_day_log has today's entry
    const logRes = await pool.query<{ n: string }>(
      `select count(*)::int as n from streak_day_log where profile_id = $1 and log_date = $2::date`,
      [profileId, today],
    );
    return Number(logRes.rows[0]?.n ?? 0) === 0;
  }
  
  // Has sessions today, check if streak_day_log has today as 'success'
  const logRes = await pool.query<{ status: string }>(
    `select status from streak_day_log where profile_id = $1 and log_date = $2::date`,
    [profileId, today],
  );
  
  // If no entry or not 'success', we need to reconcile
  return !logRes.rows[0] || logRes.rows[0].status !== 'success';
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);

    const url = new URL(request.url);
    const rawYear = url.searchParams.get("year");
    const rawMonth = url.searchParams.get("month");

    const year = rawYear ? Number(rawYear) : NaN;
    const month = rawMonth ? Number(rawMonth) : NaN;

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new ValidationError("Ano inválido.");
    }
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      throw new ValidationError("Mês inválido.");
    }

    const today = todayIso();
    
    // Only reconcile if data is stale (not already computed for today)
    // This avoids expensive computeStreak on every calendar request
    const needsReconciliation = await isStreakStale(profileId, today);
    if (needsReconciliation) {
      await computeStreak(profileId, today);
    }

    const byDate = await getStreakCalendar(profileId, year, month);
    return jsonOk({ year, month, days: byDate });
  });
}