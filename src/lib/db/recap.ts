import { ENERGYOS_LAUNCH_MONTH } from "@/types";
import type { MonthlyRecap, XpSourceBreakdown, NewLeagueTier } from "@/types";
import { BadRequestError } from "../errors";
import { parseProfileId } from "./validation";
import { NEW_TIER_ORDER, resolveNewTier } from "@/lib/league-new-meta";
import { addCoins } from "./settings";
import { STREAK_COMPLETION_THRESHOLD } from "@/lib/daily-limits";
import { APP_TIMEZONE, todayIso } from "./dates";
import { longestRunInMonth } from "@/lib/recap/streak";
import pool from "../db";

// ─── Schema & geração ────────────────────────────────────────────────────────

/**
 * Versão do algoritmo de geração. Snapshots gravados com `schema_version`
 * menor que a atual são recalculados UMA vez no próximo `getRecaps`.
 */
export const RECAP_SCHEMA_VERSION = 2;

/** Meia-noite de São Paulo (UTC−3, sem DST) como instante UTC ISO. */
function spUtcIso(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00-03:00`).toISOString();
}

/** Primeiro instante do mês em America/Sao_Paulo, expresso como UTC ISO. */
export function spMonthStartIso(monthStart: string): string {
  return spUtcIso(monthStart);
}

/**
 * Primeiro instante do mês seguinte (fim EXCLUSIVO do mês) em America/Sao_Paulo,
 * expresso como UTC ISO. Filtros devem usar `>= monthStart AND < monthEnd`.
 */
export function spMonthEndIso(monthStart: string): string {
  const next = new Date(`${monthStart.slice(0, 7)}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return spUtcIso(next.toISOString().slice(0, 10));
}

/** Último dia calendário do mês, para snapshots de liga guardados pelo início da semana. */
export function recapLeagueEndDate(monthStart: string): string {
  const next = new Date(`${monthStart.slice(0, 7)}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}

/** Primeiro dia do mês seguinte (YYYY-MM-DD) — usado para iterar dias do mês. */
function monthEndDate(monthStart: string): string {
  const d = new Date(`${monthStart}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Helpers de data / comparação ────────────────────────────────────────────

function toDateKey(value: Date | string): string {
  return typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

/** Aceita null/undefined e devolve null; caso contrário YYYY-MM-DD. */
function recapDateKey(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return toDateKey(value);
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

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
  total_xp: number;
  xp_sources: Record<string, unknown> | null;
  coins_gained: number | null;
  coins_spent: number | null;
  missions_completed: number | null;
  goals_completed: number | null;
  achievements_unlocked: number | null;
  top_focus_category: string | null;
  generation_number: number;
  schema_version: number | null;
  has_been_shared: boolean | null;
  generated_at: Date | string;
  status: string | null;
  finalized_at: Date | string | null;
  garden_count: number;
}

type RecapStatus = "live" | "final";

function mapRecap(profileId: string, row: RecapRow): MonthlyRecap {
  return {
    id: row.id,
    profileId,
    recapMonth: toDateKey(row.recap_month),
    totalFocusMinutes: row.total_focus_minutes,
    longestStreak: row.longest_streak,
    streakStartDate: row.streak_start_date ? toDateKey(row.streak_start_date) : undefined,
    streakEndDate: row.streak_end_date ? toDateKey(row.streak_end_date) : undefined,
    streakIsAlive: row.streak_is_alive ?? false,
    leagueTier: resolveNewTier(row.league_tier) ?? row.league_tier ?? undefined,
    leagueAtStart: resolveNewTier(row.league_at_start) ?? row.league_at_start ?? undefined,
    leaguePromoted: row.league_promoted ?? undefined,
    productivityTag: row.productivity_tag ?? undefined,
    gardenCount: Number(row.garden_count) || 0,
    totalXp: Number(row.total_xp) || 0,
    xpSources: row.xp_sources as XpSourceBreakdown | undefined,
    coinsGained: row.coins_gained ?? 0,
    coinsSpent: row.coins_spent ?? 0,
    missionsCompleted: row.missions_completed ?? 0,
    goalsCompleted: row.goals_completed ?? 0,
    achievementsUnlocked: row.achievements_unlocked ?? 0,
    topFocusCategory: row.top_focus_category ?? undefined,
    hasBeenShared: row.has_been_shared ?? undefined,
    generatedAt: new Date(row.generated_at).toISOString(),
    finalizedAt: row.finalized_at ? new Date(row.finalized_at).toISOString() : undefined,
    status: (row.status ?? "live") as RecapStatus,
  };
}

// ─── Month helpers ───────────────────────────────────────────────────────────

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

function resolveTag(totalMinutes: number): string {
  if (totalMinutes > 1000) return "Mestre do Foco";
  if (totalMinutes > 500) return "Guerreiro da Energia";
  if (totalMinutes > 200) return "Aprendiz Dedicada";
  return "Explorador";
}

function currentMonthStart(): string {
  return todayIso().slice(0, 7) + "-01";
}

// ─── Longest streak for a month ──────────────────────────────────────────────

/**
 * Melhor sequência DENTRO do mês (recortada na fronteira). Dias vivos = sessão
 * de foco que atingiu a duração-alvo OU dia protegido por escudo, sempre em
 * America/Sao_Paulo.
 */
async function computeLongestStreakForMonth(
  profileId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ best: number; startDate?: string; endDate?: string; isAliveAtEnd: boolean }> {
  const today = todayIso();

  const focus = await pool.query<{ day: string }>(
    `SELECT DISTINCT to_char((ended_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS day
       FROM focus_sessions
      WHERE profile_id = $2
        AND ended_at IS NOT NULL
        AND (end_reason IS NULL OR end_reason = 'completed')
        AND duration_minutes * 1.0 >= target_duration_minutes * $3
        AND ended_at >= $4::timestamptz
        AND ended_at < $5::timestamptz`,
    [
      APP_TIMEZONE,
      profileId,
      STREAK_COMPLETION_THRESHOLD,
      spMonthStartIso(monthStart),
      spMonthEndIso(monthStart),
    ],
  );
  const alive = new Set<string>(focus.rows.map((r) => r.day));

  const protectedDays = await pool.query<{ day: string }>(
    `SELECT DISTINCT to_char(used_on_date, 'YYYY-MM-DD') AS day
       FROM streak_shield_usage
      WHERE profile_id = $1
        AND used_on_date >= $2::date
        AND used_on_date < $3::date`,
    [profileId, monthStart, monthEnd],
  );
  for (const row of protectedDays.rows) alive.add(row.day);

  return longestRunInMonth(alive, monthStart, monthEndDate(monthStart), today);
}

// ─── Métricas do mês ─────────────────────────────────────────────────────────

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
  coinsGained: number;
  coinsSpent: number;
  missionsCompleted: number;
  goalsCompleted: number;
  achievementsUnlocked: number;
  topFocusCategory?: string;
}

async function computeCoinsForMonth(
  profileId: string,
  monthStartIso: string,
  monthEndIso: string,
): Promise<{ gained: number; spent: number }> {
  const result = await pool.query<{ coins: string }>(
    `SELECT COALESCE(SUM(coins_amount), 0) AS coins
       FROM xp_ledger
      WHERE profile_id = $1
        AND coins_amount > 0
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz`,
    [profileId, monthStartIso, monthEndIso],
  );
  const gained = Number(result.rows[0]?.coins ?? 0);

  const spentResult = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(-coins_amount), 0) AS total
       FROM xp_ledger
      WHERE profile_id = $1
        AND coins_amount < 0
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz`,
    [profileId, monthStartIso, monthEndIso],
  );
  const spent = Number(spentResult.rows[0]?.total ?? 0);

  return { gained, spent };
}

async function computeMissionsCompleted(
  profileId: string,
  monthStartIso: string,
  monthEndIso: string,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COALESCE(COUNT(*), 0) AS count
       FROM user_quest_progress uqp
       JOIN daily_quests dq ON uqp.quest_id = dq.id
      WHERE uqp.profile_id = $1
        AND uqp.is_completed = true
        AND uqp.quest_date >= $2::date
        AND uqp.quest_date < $3::date`,
    [profileId, monthStartIso.slice(0, 10), monthEndIso.slice(0, 10)],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export const GOALS_COMPLETED_QUERY = `
  SELECT COUNT(*) AS count
  FROM goals
  WHERE profile_id = $1
    AND completed_at IS NOT NULL
    AND completed_at >= $2::timestamptz
    AND completed_at < $3::timestamptz
`;

type RecapCountQuery = (
  sql: string,
  values: unknown[],
) => Promise<{ rows: Array<{ count: string | number }> }>;

/**
 * Conta metas cujo estado persistido de conclusão caiu dentro do mês.
 * Um log de progresso sozinho não prova que a meta foi atingida.
 */
export async function computeGoalsCompleted(
  profileId: string,
  monthStartIso: string,
  monthEndIso: string,
  query: RecapCountQuery = (sql, values) => pool.query(sql, values),
): Promise<number> {
  const result = await query(GOALS_COMPLETED_QUERY, [profileId, monthStartIso, monthEndIso]);
  return Number(result.rows[0]?.count ?? 0);
}

async function computeAchievementsUnlocked(
  profileId: string,
  monthStartIso: string,
  monthEndIso: string,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COALESCE(COUNT(*), 0) AS count
       FROM user_achievement_progress
      WHERE profile_id = $1
        AND unlocked_at IS NOT NULL
        AND unlocked_at >= $2::timestamptz
        AND unlocked_at < $3::timestamptz`,
    [profileId, monthStartIso, monthEndIso],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function computeTopFocusCategory(
  profileId: string,
  monthStartIso: string,
  monthEndIso: string,
): Promise<string | undefined> {
  const result = await pool.query<{ name: string; total: string }>(
    `SELECT c.name,
            SUM(
              LEAST(
                GREATEST(fs.duration_minutes, 0),
                GREATEST(CEIL(COALESCE(NULLIF(fs.target_duration_minutes, 0), 120) * 1.05), 1)
              )
            ) AS total
       FROM focus_sessions fs
       JOIN tasks t ON fs.task_id = t.id
       JOIN categories c ON t.category_id = c.id
      WHERE fs.profile_id = $1
        AND fs.ended_at IS NOT NULL
        AND fs.ended_at >= $2::timestamptz
        AND fs.ended_at < $3::timestamptz
        AND (fs.end_reason IS NULL OR fs.end_reason = 'completed')
        AND fs.duration_minutes > 0
      GROUP BY c.id, c.name
      ORDER BY total DESC
      LIMIT 1`,
    [profileId, monthStartIso, monthEndIso],
  );
  return result.rows[0]?.name ?? undefined;
}

/**
 * XP ganho NESTE mês a partir de xp_ledger. Janela em America/Sao_Paulo:
 * [primeiro instante do mês, primeiro instante do mês seguinte).
 */
async function computeXpForMonth(
  profileId: string,
  monthStart: string,
): Promise<{ totalXp: number; breakdown: Record<string, number> }> {
  const monthStartIso = spMonthStartIso(monthStart);
  const monthEndIso = spMonthEndIso(monthStart);

  const result = await pool.query<{ source: string; xp: number }>(
    `SELECT source, SUM(xp_amount) AS xp
       FROM xp_ledger
      WHERE profile_id = $1
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz
      GROUP BY source`,
    [profileId, monthStartIso, monthEndIso],
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

// ─── Liga ────────────────────────────────────────────────────────────────────

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

async function getCurrentLeagueTier(profileId: string): Promise<string | undefined> {
  const current = await getLeagueAtPoint(profileId, todayIso());
  return current?.tier ?? undefined;
}

async function withRecapLeagueBadge(profileId: string, recap: MonthlyRecap): Promise<MonthlyRecap> {
  const historical = await getLeagueAtPoint(profileId, recapLeagueEndDate(recap.recapMonth));
  const historicalTier = resolveNewTier(historical?.tier);
  if (historicalTier) {
    return { ...recap, leagueTier: historicalTier };
  }

  const savedTier = resolveNewTier(recap.leagueTier);
  if (savedTier) return { ...recap, leagueTier: savedTier };

  console.warn(
    `[recap] Missing historical league snapshot for profile ${profileId}, month ${recap.recapMonth}; using the latest available league.`,
  );
  const currentTier = resolveNewTier(await getCurrentLeagueTier(profileId));
  if (currentTier) return { ...recap, leagueTier: currentTier };

  console.error(
    `[recap] No league ranking data found for profile ${profileId}; using the initial Bronze league badge.`,
  );
  return { ...recap, leagueTier: "BRONZE" };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

async function buildRecapSummary(
  profileId: string,
  monthStart: string,
  monthEnd: string,
  isCurrentMonth: boolean = false,
): Promise<RecapSummary> {
  const monthStartIso = spMonthStartIso(monthStart);
  const monthEndIso = spMonthEndIso(monthStart);

  const [
    focusRow,
    streakResult,
    leagueStart,
    leagueEnd,
    xpResult,
    coinsResult,
    missionsResult,
    goalsResult,
    achievementsResult,
    topCategoryResult,
  ] = await Promise.all([
    // Focused time = real focused minutes saved by the timer (duration_minutes),
    // NOT wall-clock ended_at-started_at (which includes pauses/breaks and stale
    // sessions closed long after they started). Each session is capped at its
    // target duration plus a small tolerance. Only completed sessions count;
    // gave_up/cancelled/abandoned carry no focus credit. Uses end_reason for
    // compatibility with databases where focus_sessions.status is not yet applied.
    pool.query<{ minutes: string | number }>(
      `SELECT COALESCE(
                SUM(
                  LEAST(
                    GREATEST(duration_minutes, 0),
                    GREATEST(CEIL(COALESCE(NULLIF(target_duration_minutes, 0), 120) * 1.05), 1)
                  )
                ),
                0
              ) AS minutes
         FROM focus_sessions
        WHERE profile_id = $1
          AND ended_at IS NOT NULL
          AND ended_at >= $2::timestamptz
          AND ended_at < $3::timestamptz
          AND (end_reason IS NULL OR end_reason = 'completed')
          AND duration_minutes > 0`,
      [profileId, monthStartIso, monthEndIso],
    ),
    computeLongestStreakForMonth(profileId, monthStart, monthEnd),
    getLeagueAtPoint(profileId, monthStart),
    getLeagueAtPoint(profileId, recapLeagueEndDate(monthStart)),
    computeXpForMonth(profileId, monthStart),
    computeCoinsForMonth(profileId, monthStartIso, monthEndIso),
    computeMissionsCompleted(profileId, monthStartIso, monthEndIso),
    computeGoalsCompleted(profileId, monthStartIso, monthEndIso),
    computeAchievementsUnlocked(profileId, monthStartIso, monthEndIso),
    computeTopFocusCategory(profileId, monthStartIso, monthEndIso),
  ]);
 
  const maxMinutesInMonth = Math.round(
    (new Date(monthEndIso).getTime() - new Date(monthStartIso).getTime()) / 60_000,
  );
  const totalMinutes = Math.min(
    Math.max(0, Math.round(Number(focusRow.rows[0]?.minutes ?? 0))),
    maxMinutesInMonth,
  );
  const bestStreak = streakResult.best;
 
 
  const today = todayIso();
  const streakIsAlive =
    isCurrentMonth || (monthStart <= today && today < monthEnd && bestStreak > 0);

  const endTier = leagueEnd?.tier ?? undefined;
  const startTier = leagueStart?.tier ?? undefined;
  const normalizedEndTier = endTier ? resolveNewTier(endTier) : undefined;
  const normalizedStartTier = startTier ? resolveNewTier(startTier) : undefined;

  const promoted =
    normalizedStartTier !== undefined &&
    normalizedEndTier !== undefined &&
    NEW_TIER_ORDER.indexOf(normalizedEndTier as NewLeagueTier) >
      NEW_TIER_ORDER.indexOf(normalizedStartTier as NewLeagueTier);

  return {
    totalFocusMinutes: totalMinutes,
    longestStreak: bestStreak,
    streakStartDate: streakResult.startDate,
    streakEndDate: streakResult.endDate,
    streakIsAlive,
    leagueTier: normalizedEndTier ?? undefined,
    leagueAtStart: normalizedStartTier ?? undefined,
    promoted,
    productivityTag: resolveTag(totalMinutes),
    totalXp: Math.round(xpResult.totalXp),
    coinsGained: Math.round(coinsResult.gained),
    coinsSpent: Math.round(coinsResult.spent),
    xpSources: xpResult.breakdown,
    missionsCompleted: missionsResult,
    goalsCompleted: goalsResult,
    achievementsUnlocked: achievementsResult,
    topFocusCategory: topCategoryResult ?? undefined,
  };
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

/** Tier gravado no banco (mesma regra usada no INSERT, para comparar igual). */
function storedLeagueTier(summary: RecapSummary): string {
  return summary.leagueTier ?? summary.leagueAtStart ?? "BRONZE";
}

function recapMatchesSummary(
  row: RecapRow,
  summary: RecapSummary,
  status: RecapStatus,
): boolean {
  return (
    row.status === status &&
    Number(row.total_focus_minutes) === summary.totalFocusMinutes &&
    Number(row.longest_streak) === summary.longestStreak &&
    recapDateKey(row.streak_start_date) === (summary.streakStartDate ?? null) &&
    recapDateKey(row.streak_end_date) === (summary.streakEndDate ?? null) &&
    row.streak_is_alive === summary.streakIsAlive &&
    row.league_tier === storedLeagueTier(summary) &&
    row.league_at_start === (summary.leagueAtStart ?? null) &&
    row.league_promoted === summary.promoted &&
    row.productivity_tag === summary.productivityTag &&
    Number(row.total_xp) === summary.totalXp &&
    stableJson(row.xp_sources) === stableJson(summary.xpSources) &&
    Number(row.coins_gained ?? 0) === summary.coinsGained &&
    Number(row.coins_spent ?? 0) === summary.coinsSpent &&
    Number(row.missions_completed ?? 0) === summary.missionsCompleted &&
    Number(row.goals_completed ?? 0) === summary.goalsCompleted &&
    Number(row.achievements_unlocked ?? 0) === summary.achievementsUnlocked &&
    row.top_focus_category === (summary.topFocusCategory ?? null)
  );
}

async function upsertRecap(
  profileId: string,
  monthStart: string,
  summary: RecapSummary,
  status: RecapStatus = "live",
): Promise<MonthlyRecap> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `${profileId}:${monthStart}`,
    ]);

    const existing = await client.query<RecapRow>(
      `SELECT r.*,
              (SELECT COUNT(*) FROM garden_entries g
                WHERE g.profile_id = r.profile_id
                  AND DATE_TRUNC('year', g.planted_at) = DATE_TRUNC('year', r.recap_month)) AS garden_count
         FROM monthly_recaps r
        WHERE r.profile_id = $1 AND r.recap_month = $2
          FOR UPDATE OF r`,
      [profileId, monthStart],
    );
    const old = existing.rows[0];

    if (old?.status === "final" || (old && recapMatchesSummary(old, summary, status))) {
      await client.query("COMMIT");
      return mapRecap(profileId, old);
    }

    const finalizedAt = status === "final" ? new Date().toISOString() : null;
    const result = await client.query<RecapRow>(
      `INSERT INTO monthly_recaps (
         profile_id, recap_month, total_focus_minutes, longest_streak, streak_start_date,
         streak_end_date, streak_is_alive, league_tier, league_at_start, league_promoted,
         productivity_tag, total_xp, xp_sources, coins_gained, coins_spent,
         missions_completed, goals_completed, achievements_unlocked, top_focus_category,
         generation_number, status, finalized_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, 1, $20, $21
       )
       ON CONFLICT (profile_id, recap_month)
       DO UPDATE SET
         total_focus_minutes = EXCLUDED.total_focus_minutes,
         longest_streak = EXCLUDED.longest_streak,
         streak_start_date = EXCLUDED.streak_start_date,
         streak_end_date = EXCLUDED.streak_end_date,
         streak_is_alive = EXCLUDED.streak_is_alive,
         league_tier = EXCLUDED.league_tier,
         league_at_start = EXCLUDED.league_at_start,
         league_promoted = EXCLUDED.league_promoted,
         productivity_tag = EXCLUDED.productivity_tag,
         total_xp = EXCLUDED.total_xp,
         xp_sources = EXCLUDED.xp_sources,
         coins_gained = EXCLUDED.coins_gained,
         coins_spent = EXCLUDED.coins_spent,
         missions_completed = EXCLUDED.missions_completed,
         goals_completed = EXCLUDED.goals_completed,
         achievements_unlocked = EXCLUDED.achievements_unlocked,
         top_focus_category = EXCLUDED.top_focus_category,
         generation_number = monthly_recaps.generation_number + 1,
         status = EXCLUDED.status,
         finalized_at = COALESCE(monthly_recaps.finalized_at, EXCLUDED.finalized_at),
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
        storedLeagueTier(summary),
        summary.leagueAtStart ?? null,
        summary.promoted,
        summary.productivityTag,
        summary.totalXp,
        summary.xpSources ? JSON.stringify(summary.xpSources) : null,
        summary.coinsGained,
        summary.coinsSpent,
        summary.missionsCompleted,
        summary.goalsCompleted,
        summary.achievementsUnlocked,
        summary.topFocusCategory ?? null,
        status,
        finalizedAt,
      ],
    );

    if (old) {
      await client.query(
        `INSERT INTO monthly_recap_history (
           recap_id, profile_id, recap_month, total_focus_minutes, longest_streak,
           streak_start_date, streak_end_date, streak_is_alive, league_at_start, league_at_end,
           league_promoted, productivity_tag, total_xp, xp_sources, generation_number,
           generation_count, garden_count, coins_gained, coins_spent, missions_completed, goals_completed,
           achievements_unlocked, top_focus_category, generated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
           $15, $16, $17, $18, $19, $20, $21, $22, $23
         )`,
        [
          old.id,
          old.profile_id,
          old.recap_month,
          old.total_focus_minutes,
          old.longest_streak,
          old.streak_start_date,
          old.streak_end_date,
          old.streak_is_alive,
          old.league_at_start ?? "BRONZE",
          old.league_tier ?? old.league_at_start ?? "BRONZE",
          old.league_promoted,
          old.productivity_tag,
          old.total_xp,
          old.xp_sources,
          old.generation_number,
          Number(old.garden_count) || 0,
          old.coins_gained ?? 0,
          old.coins_spent ?? 0,
          old.missions_completed ?? 0,
          old.goals_completed ?? 0,
          old.achievements_unlocked ?? 0,
          old.top_focus_category,
          old.generated_at,
        ],
      );
    }

    const gardenCount = await client.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
         FROM garden_entries
        WHERE profile_id = $1
          AND DATE_TRUNC('year', planted_at) = DATE_TRUNC('year', $2::date)`,
      [profileId, monthStart],
    );

    await client.query("COMMIT");
    return mapRecap(profileId, {
      ...result.rows[0],
      garden_count: Number(gardenCount.rows[0]?.count ?? 0),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function getRecaps(profileId: string): Promise<MonthlyRecap[]> {
  parseProfileId(profileId);

  const result = await pool.query<RecapRow>(
    `SELECT r.id, r.profile_id, r.recap_month, r.total_focus_minutes, r.longest_streak,
            r.streak_start_date, r.streak_end_date, r.streak_is_alive, r.league_tier, r.league_at_start,
            r.league_promoted, r.productivity_tag, r.generated_at, r.total_xp, r.xp_sources,
            r.coins_gained, r.coins_spent, r.missions_completed, r.goals_completed,
            r.achievements_unlocked, r.top_focus_category,
            r.generation_number, r.has_been_shared, r.status, r.finalized_at,
            (SELECT COUNT(*) FROM garden_entries g
              WHERE g.profile_id = r.profile_id
                AND DATE_TRUNC('year', g.planted_at) = DATE_TRUNC('year', r.recap_month)) AS garden_count
       FROM monthly_recaps r
      WHERE r.profile_id = $1 AND r.recap_month >= $2::date
      ORDER BY r.recap_month DESC`,
    [profileId, ENERGYOS_LAUNCH_MONTH],
  );

  const currentMonth = currentMonthStart();
  const output: MonthlyRecap[] = [];

  for (const row of result.rows) {
    const monthStart = toDateKey(row.recap_month);

    if (monthStart === currentMonth) {
      // Mês em andamento: atualiza ao vivo, mantendo o mesmo registro ("live").
      const summary = await buildRecapSummary(profileId, monthStart, monthEndDate(monthStart), true);
      output.push(
        await withRecapLeagueBadge(
          profileId,
          await upsertRecap(profileId, monthStart, summary, "live"),
        ),
      );
    } else if (row.status !== "final" && monthStart < currentMonth) {
      // Mês encerrado ainda não finalizado: calcula uma última vez e grava "final".
      const summary = await buildRecapSummary(profileId, monthStart, monthEndDate(monthStart), false);
      output.push(
        await withRecapLeagueBadge(
          profileId,
          await upsertRecap(profileId, monthStart, summary, "final"),
        ),
      );
    } else {
      output.push(await withRecapLeagueBadge(profileId, mapRecap(profileId, row)));
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

  const currentMonth = currentMonthStart();
  if (monthStart > currentMonth) {
    throw new BadRequestError("Não é possível gerar recap para meses futuros.");
  }

  const accountAge = await pool.query<{ created_at: Date | string }>(
    "SELECT created_at FROM profiles WHERE id = $1",
    [profileId],
  );
  if (accountAge.rows[0]) {
    const createdDate = toDateKey(accountAge.rows[0].created_at);
    if (createdDate > monthStart) {
      throw new BadRequestError("O energyOS ainda não existia neste mês.");
    }
  }

  const isCurrentMonth = monthStart === currentMonth;
  const summary = await buildRecapSummary(
    profileId,
    monthStart,
    monthEndDate(monthStart),
    isCurrentMonth,
  );
  return withRecapLeagueBadge(
    profileId,
    await upsertRecap(profileId, monthStart, summary, isCurrentMonth ? "live" : "final"),
  );
}

const SHARE_REWARD_COINS = 50;

export async function markRecapShared(
  profileId: string,
  recapId: number,
): Promise<{ newBalance: number; wasFirstShare: boolean }> {
  parseProfileId(profileId);

  const result = await pool.query<{ has_been_shared: boolean | null }>(
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