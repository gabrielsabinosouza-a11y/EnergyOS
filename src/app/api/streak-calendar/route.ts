import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, routeContext } from "@/lib/http";
import { computeStreak, getStreakCalendar } from "@/lib/db/tasks";
import { ValidationError } from "@/lib/db/validation";
import { APP_TIMEZONE, todayIso } from "@/lib/db/dates";
import pool from "@/lib/db";
import { needsStreakReconciliation } from "@/lib/streak-reconcile";

async function isStreakStale(profileId: string, today: string): Promise<boolean> {
  const result = await pool.query<{
    current_streak: number;
    latest_focus_day: string | null;
    latest_protected_day: string | null;
    latest_log_day: string | null;
  }>(
    `select coalesce(p.current_streak, 0)::int as current_streak,
       (select to_char(max((fs.ended_at at time zone $2)::date), 'YYYY-MM-DD')
          from focus_sessions fs
         where fs.profile_id = p.id
           and fs.ended_at is not null
           and fs.duration_minutes >= 1
           and (fs.ended_at at time zone $2)::date > ($3::date - interval '400 days')
           and (fs.ended_at at time zone $2)::date <= $3::date) as latest_focus_day,
       (select to_char(max(su.used_on_date), 'YYYY-MM-DD')
          from streak_shield_usage su
         where su.profile_id = p.id
           and su.used_on_date > ($3::date - interval '400 days')
           and su.used_on_date <= $3::date) as latest_protected_day,
       (select to_char(max(sdl.log_date), 'YYYY-MM-DD')
          from streak_day_log sdl
         where sdl.profile_id = p.id
           and sdl.log_date > ($3::date - interval '400 days')
           and sdl.log_date <= $3::date) as latest_log_day
       from profiles p
      where p.id = $1`,
    [profileId, APP_TIMEZONE, today],
  );
  const row = result.rows[0];
  if (!row) return true;

  return needsStreakReconciliation({
    currentStreak: row.current_streak,
    latestFocusDay: row.latest_focus_day,
    latestProtectedDay: row.latest_protected_day,
    latestLogDay: row.latest_log_day,
    today,
  });
}

export async function GET(request: NextRequest) {
  const started = Date.now();

  const mark = (stage: string) => {
    console.info(`[streak-calendar] ${stage}: ${Date.now() - started}ms`);
  };

  return handleRoute(async () => {
    mark("Request started");

    const { profileId } = await requireAuth(request);
    mark("Authentication completed");

    await ensureUserBootstrap(profileId);
    mark("Bootstrap completed");

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

    mark("Checking streak reconciliation");
    const needsReconciliation = await isStreakStale(profileId, today);
    mark(`Reconciliation check completed: ${needsReconciliation}`);

    if (needsReconciliation) {
      mark("Starting computeStreak");
      await computeStreak(profileId, today);
      mark("computeStreak completed");
    }

    mark("Starting getStreakCalendar");
    const byDate = await getStreakCalendar(profileId, year, month);
    mark("getStreakCalendar completed");

    return jsonOk({ year, month, days: byDate });
  }, routeContext(request, "/api/streak-calendar"));
}
