import pool from "../db";
import { ENERGYOS_LAUNCH_MONTH } from "@/types";
import type { MonthlyRecap, XpSourceBreakdown } from "@/types";
import { BadRequestError } from "../errors";
import { parseProfileId } from "./validation";
import type { TargetAndTransition } from "framer-motion"
import { NEW_TIER_ORDER } from "@/lib/league-new-meta";
import { addCoins } from "./settings";
import { STREAK_COMPLETION_THRESHOLD } from "@/lib/daily-limits";
import { APP_TIMEZONE, addDaysIso, todayIso } from "./dates";

// ─── Row mapping ─────────────────────────────────────────────────────────────

/** Detect whether a column exists on a table (cached). */
const columnCache = new Map<string, Promise<boolean>>();
function hasColumn(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (!columnCache.has(key)) {
    columnCache.set(
      key,
      pool
        .query<{ exists: boolean }>(
          `select exists (
             select 1 from information_schema.columns
             where table_name = $1 and column_name = $2
           ) as exists`,
          [table, column],
        )
        .then((r) => r.rows[0]?.exists ?? false)
        .catch(() => false),
    );
  }
  return columnCache.get(key)!;
}

interface RecapRow {
  id: number;
  profile_id: string;
  recap_month: Date | string;
  total_focus_minutes: number;
  longest_streak: number;
  streak_start_date: Date | string | null;
  streak_end_date: Date | string | null;
  streak_is_alive: boolean;
  league_tier: string | null;
  league_at_start: string | null;
  league_promoted: boolean | null;
  productivity_tag: string | null;
  garden_count: number;
  total_xp: number;
  xp_sources: Record<string, unknown> | null;
  generation_number: number;
  has_been_shared: boolean | null;
  generated_at: Date | string;
}

function mapRecap(profileId: string, row: RecapRow): MonthlyRecap {
  return {
    id: row.id,
    profileId,
    recapMonth: typeof row.recap_month === "string" ? row.recap_month : row.recap_month.toISOString().slice(0, 10),
    totalFocusMinutes: row.total_focus_minutes,
    longestStreak: row.longest_streak,
    streakStartDate: row.streak_start_date ? (typeof row.streak_start_date === "string" ? row.streak_start_date : row.streak_start_date.toISOString().slice(0, 10)) : undefined,
    streakEndDate: row.streak_end_date ? (typeof row.streak_end_date === "string" ? row.streak_end_date : row.streak_end_date.toISOString().slice(0, 10)) : undefined,
    streakIsAlive: row.streak_is_alive ?? false,
    leagueTier: row.league_tier ?? undefined,
    leagueAtStart: row.league_at_start ?? undefined,
    leaguePromoted: row.league_promoted ?? undefined,
    productivityTag: row.productivity_tag ?? undefined,
    gardenCount: Number(row.garden_count) || 0,
    totalXp: Number(row.total_xp) || 0,
    xpSources: row.xp_sources as XpSourceBreakdown | undefined,
    hasBeenShared: row.has_been_shared ?? undefined,
    generatedAt: new Date(row.generated_at).toISOString(),
  };
}

// ─── Month helpers ────────────────────────────────────────────────────────────

function resolveMonthStart(monthDate: string): string {
  if (!/^\d{4}-\d{2}/.test(monthDate)) {
    throw new BadRequestError("Mês inválido.");
  }
  const monthStart = monthDate.slice(0, 7) + "-01";
  if (monthStart < ENERGYOS_LAUNCH_MONTH) {
    throw new BadRequestError("O energyOS ainda não existia neste mês.");
  }
  return monthStart;
}

function getMonthEnd(monthStart: string): string {
  const next = new Date(`${monthStart}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function resolveTag(totalMinutes: number): string {
  if (totalMinutes > 1000) return "Mestre do Foco";
  if (totalMinutes > 500) return "Guerreiro da Energia";
  if (totalMinutes > 200) return "Aprendiz Dedicada";
  return "Explorador";
}

// ─── Longest streak for a month ──────────────────────────────────────────────

async function computeLongestStreakForMonth(
  profileId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ best: number; startDate?: string; endDate?: string }> {
  const today = todayIso();
  const windowStart = addDaysIso(monthStart, -400);
  const windowEnd = addDaysIso(monthEnd, 400);

  // Days with qualifying focus sessions
  const focus = await pool.query<{ day: string }>(
    `select distinct to_char((ended_at at time zone $1)::date, 'YYYY-MM-DD') as day
       from focus_sessions
      where profile_id = $2
        and ended_at is not null
        and duration_minutes * 1.0 >= target_duration_minutes * $3
        and (ended_at at time zone $1)::date >= $4::date
        and (ended_at at time zone $1)::date < $5::date`,
    [APP_TIMEZONE, profileId, STREAK_COMPLETION_THRESHOLD, windowStart, windowEnd],
  );
  const alive = new Set<string>(focus.rows.map((r) => r.day));

  // Protected days by shield
  const protectedDays = await pool.query<{ day: string }>(
    `select distinct to_char(used_on_date, 'YYYY-MM-DD') as day
       from streak_shield_usage
      where profile_id = $1
        and used_on_date >= $2::date
        and used_on_date < $3::date`,
    [profileId, windowStart, windowEnd],
  );
  for (const row of protectedDays.rows) alive.add(row.day);

  // Find longest run
  let best = 0;
  let runStart: string | undefined;
  let runCurrentStart: string | undefined;
  let run = 0;
  let runTouchesMonth = false;

  const cursor = new Date(windowStart);
  for (
    let cursorDate = new Date(windowStart);
    cursorDate.toISOString().slice(0, 10) < windowEnd;
    cursorDate.setDate(cursorDate.getDate() + 1)
  ) {
    const cursorStr = cursorDate.toISOString().slice(0, 10);
    const inMonth = cursorStr >= monthStart && cursorStr < monthEnd;
    if (inMonth && !runTouchesMonth) {
      runTouchesMonth = true;
      runCurrentStart = cursorStr;
    }

    const isAlive = alive.has(cursorStr);
    const isOpenToday = cursorStr === today && !isAlive;

    if (isAlive) {
      if (run === 0) runStart = cursorStr;
      run += 1;
    } else if (isOpenToday) {
      if (run > best && runTouchesMonth) {
        best = run;
      }
    } else {
      if (run > best && runTouchesMonth) {
        best = run;
      }
      run = 0;
      runTouchesMonth = false;
      runStart = undefined;
    }
  }
  if (run > best && runTouchesMonth) {
    best = run;
  }

  return { best, startDate: runStart, endDate: runStart };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

function currentMonthStart(): string {
  return todayIso().slice(0, 7) + "-01";
}

function monthEndUtcIso(monthStart: string): string {
  const endDay = getMonthEnd(monthStart);
  return new Date(`${endDay}T00:00:00-03:00`).toISOString();
}

interface RecapSummary {
  totalFocusMinutes: number;
  longestStreak: number;
  streakStartDate?: string;
  streakEndDate?: string;
  streakIsAlive: boolean;
  leagueTier?: string;
  leagueAtStart?: string;
  promoted: boolean;
  productivityTag: string;
  totalXp: number;
  xpSources: Record<string, number>;
}

/**
 * Computes XP gained IN THIS MONTH from the xp_ledger table.
 */
async function computeXpForMonth(
  profileId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ totalXp: number; breakdown: Record<string, number> }> {
  const result = await pool.query<{ source: string; xp: number }>(
    `SELECT source, SUM(xp_amount) as xp
     FROM xp_ledger
     WHERE profile_id = $1
       AND created_at >= $2::timestamp
       AND created_at < $3::timestamp
     GROUP BY source`,
    [profileId, monthStart, monthEnd],
  );

  let totalXp = 0;
  const breakdown: Record<string, number> = {};

  for (const row of result.rows) {
    const amount = Number(row.xp) || 0;
    totalXp += amount;
    breakdown[row.source] = amount;
  }

  return { totalXp, breakdown };
}

/**
 * Gets the league at a specific point in time for a profile.
 */
async function getLeagueAtPoint(
  profileId: string,
  pointDate: string,
): Promise<{ tier: string | null } | null> {
  const result = await pool.query<{ tier: string }>(
    `SELECT lg.tier
     FROM league_group_members lgm
     JOIN league_groups lg ON lgm.league_group_id = lg.id
     WHERE lgm.profile_id = $1
       AND lg.week_start_date <= $2::date
     ORDER BY lg.week_start_date DESC
     LIMIT 1`,
    [profileId, pointDate],
  );

  if (!result.rows[0]) return null;
  return { tier: result.rows[0].tier };
}

async function buildRecapSummary(
  profileId: string,
  monthStart: string,
  monthEnd: string,
  isCurrentMonth: boolean = false,
): Promise<RecapSummary> {
  const [focusRow, streakResult, leagueStart, leagueEnd, xpResult] = await Promise.all([
    pool.query<{ minutes: string | number }>(
      `select coalesce(sum(duration_minutes), 0) as minutes
       from focus_sessions
       where profile_id = $1 and ended_at is not null
         and started_at >= $2::date and started_at < $3::date`,
      [profileId, monthStart, monthEnd],
    ),
    computeLongestStreakForMonth(profileId, monthStart, monthEnd),
    getLeagueAtPoint(profileId, monthStart),
    getLeagueAtPoint(profileId, monthEnd),
    computeXpForMonth(profileId, monthStart, monthEnd),
  ]);

  const totalMinutes = Number(focusRow.rows[0]?.minutes ?? 0);
  const bestStreak = streakResult.best;

  const today = todayIso();
  const streakIsAlive = isCurrentMonth ||
    (monthStart <= today && today < monthEnd && bestStreak > 0);

  const endTier = leagueEnd?.tier ?? undefined;
  const startTier = leagueStart?.tier ?? undefined;
  const normalizedEndTier = normalizeTier(leagueEnd?.tier);
  const normalizedStartTier = normalizeTier(leagueStart?.tier);



  const promoted =
    normalizedStartTier !== undefined &&
    normalizedEndTier !== undefined &&
    NEW_TIER_ORDER.indexOf(normalizedEndTier) > NEW_TIER_ORDER.indexOf(normalizedStartTier);

  return {
    totalFocusMinutes: totalMinutes,
    longestStreak: bestStreak,
    streakStartDate: streakResult.startDate,
    streakEndDate: streakResult.endDate,
    streakIsAlive,
    leagueTier: normalizedEndTier,
    leagueAtStart: normalizedStartTier,
    promoted,
    productivityTag: resolveTag(totalMinutes),
    totalXp: xpResult.totalXp,
    xpSources: xpResult.breakdown,
  };
}

async function upsertRecap(
  profileId: string,
  monthStart: string,
  summary: RecapSummary,
): Promise<MonthlyRecap> {
  const result = await pool.query<RecapRow>(
    `INSERT INTO monthly_recaps (
      profile_id, recap_month, total_focus_minutes, longest_streak, streak_start_date,
      streak_end_date, streak_is_alive, league_tier, league_at_start, league_promoted,
      productivity_tag, total_xp, xp_sources, generation_number
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    ) ON CONFLICT (profile_id, recap_month)
       DO UPDATE SET
         total_focus_minutes = excluded.total_focus_minutes,
         longest_streak = excluded.longest_streak,
         streak_start_date = excluded.streak_start_date,
         streak_end_date = excluded.streak_end_date,
         streak_is_alive = excluded.streak_is_alive,
         league_tier = excluded.league_tier,
         league_at_start = excluded.league_at_start,
         league_promoted = excluded.league_promoted,
         productivity_tag = excluded.productivity_tag,
         total_xp = excluded.total_xp,
         xp_sources = excluded.xp_sources,
         generation_number = monthly_recaps.generation_number + 1,
         generated_at = now()
    RETURNING *`,
    [
      profileId,
      monthStart,
      summary.totalFocusMinutes,
      summary.longestStreak,
      summary.streakStartDate ?? null,
      summary.streakEndDate ?? null,
      summary.streakIsAlive,
      summary.leagueTier ?? null,
      summary.leagueAtStart ?? null,
      summary.promoted ? true : false,
      summary.productivityTag,
      summary.totalXp,
      summary.xpSources ? JSON.stringify(summary.xpSources) : null,
      1,
    ],
  );

  // Save previous generation to history if this is an update
  const prevRow = await pool.query<{ generation_number: number }>(
    'SELECT generation_number FROM monthly_recap_history WHERE recap_id = $1 ORDER BY generation_number DESC LIMIT 1',
    [result.rows[0].id],
  );

  if (prevRow.rows.length > 0) {
    // There's a previous generation - save current to history before update
    // Actually, we need to save the OLD snapshot before overwriting
    await pool.query(
      `INSERT INTO monthly_recap_history
       (recap_id, profile_id, recap_month, total_focus_minutes, longest_streak,
        streak_start_date, streak_end_date, streak_is_alive, league_at_start, league_at_end,
        league_promoted, productivity_tag, total_xp, xp_sources, generation_number, generated_at)
       SELECT
         $1, r.profile_id, r.recap_month, r.total_focus_minutes, r.longest_streak,
         r.streak_start_date, r.streak_end_date, r.streak_is_alive, r.league_at_start, r.league_tier,
         r.league_promoted, r.productivity_tag, r.total_xp, r.xp_sources, r.generation_number, r.generated_at
       FROM monthly_recaps r
       WHERE r.id = $1`,
      [result.rows[0].id],
    );
  }

  return mapRecap(profileId, result.rows[0]);
}

export async function getRecaps(profileId: string): Promise<MonthlyRecap[]> {
  parseProfileId(profileId);

  const result = await pool.query<RecapRow>(
    `SELECT r.id, r.profile_id, r.recap_month, r.total_focus_minutes, r.longest_streak,
            r.streak_start_date, r.streak_end_date, r.streak_is_alive, r.league_tier, r.league_at_start,
            r.league_promoted, r.productivity_tag, r.generated_at, r.total_xp, r.xp_sources,
            r.generation_number, r.has_been_shared,
            (SELECT COUNT(*) FROM garden_entries g
             WHERE g.profile_id = r.profile_id
               AND DATE_TRUNC('year', g.planted_at) = DATE_TRUNC('year', r.recap_month)) as garden_count
     FROM monthly_recaps r
     WHERE r.profile_id = $1 AND r.recap_month >= $2::date
     ORDER BY r.recap_month DESC`,
    [profileId, ENERGYOS_LAUNCH_MONTH],
  );

  const currentMonth = currentMonthStart();
  const output: MonthlyRecap[] = [];

  for (const row of result.rows) {
    const monthStart = typeof row.recap_month === "string"
      ? row.recap_month.slice(0, 10)
      : row.recap_month.toISOString().slice(0, 10);

    if (monthStart === currentMonth) {
      const monthEnd = getMonthEnd(monthStart);
      const summary = await buildRecapSummary(profileId, monthStart, monthEnd, true);
      output.push(await upsertRecap(profileId, monthStart, summary));
    } else {
      output.push(mapRecap(profileId, row));
    }
  }
  return output;
}

export async function generateRecap(
  profileId: string,
  monthDate: string,
): Promise<MonthlyRecap> {
  parseProfileId(profileId);
  const monthStart = resolveMonthStart(monthDate);
  const monthEnd = getMonthEnd(monthStart);

  const today = todayIso();
  if (monthStart > today.slice(0, 7) + "-01") {
    throw new BadRequestError("Não é possível gerar recap para meses futuros.");
  }

  // Check if account is old enough
  const accountAge = await pool.query<{ created_at: Date | string }>(
    'SELECT created_at FROM profiles WHERE id = $1',
    [profileId],
  );
  if (accountAge.rows[0]) {
    const created = accountAge.rows[0].created_at;
    const createdDate = typeof created === "string" ? created.slice(0, 10) : created.toISOString().slice(0, 10);
    if (createdDate > monthStart) {
      throw new BadRequestError("O energyOS ainda não existia neste mês.");
    }
  }

  const summary = await buildRecapSummary(profileId, monthStart, monthEnd, false);
  return upsertRecap(profileId, monthStart, summary);
}

const SHARE_REWARD_COINS = 50;

export async function markRecapShared(profileId: string, recapId: number): Promise<{ newBalance: number; wasFirstShare: boolean }> {
  parseProfileId(profileId);

  const result = await pool.query<{ has_been_shared: boolean | null; }>(
    `UPDATE monthly_recaps
     SET has_been_shared = true
     WHERE id = $1 AND profile_id = $2 AND has_been_shared = false
     RETURNING has_been_shared`,
    [recapId, profileId],
  );

  const wasFirstShare = (result.rowCount ?? 0) > 0;

  if (wasFirstShare) {
    const settings = await addCoins(profileId, SHARE_REWARD_COINS);
    return { newBalance: settings.coins, wasFirstShare: true };
  }

  const currentBalance = await pool.query<{ coins: number }>(
    `SELECT coins FROM user_settings WHERE profile_id = $1`,
    [profileId],
  );

  return {
    newBalance: currentBalance.rows[0]?.coins ?? 0,
    wasFirstShare: false,
  };
}
