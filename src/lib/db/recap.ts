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
 * menor que a atual são recalculados UMA vez no próximo `getRecaps`
 * (caminho de upgrade que corrige os dados antigos: XP zerado e a mesma
 * sequência duplicada entre dois meses).
 */
export const RECAP_SCHEMA_VERSION = 2;

/** Idempotência: repetir a geração em menos de 15s devolve o snapshot atual. */
const GENERATION_COOLDOWN_MS = 15_000;

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
 * expresso como UTC ISO. Filtros de atividade devem usar
 * `started_at/created_at >= monthStart AND < monthEnd`, de forma que o último
 * dia do mês e o primeiro dia do próximo nunca se percam nem se dupliquem.
 */
export function spMonthEndIso(monthStart: string): string {
  const next = new Date(`${monthStart.slice(0, 7)}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return spUtcIso(next.toISOString().slice(0, 10));
}

/** Primeiro dia do mês seguinte (YYYY-MM-DD) — usado para iterar dias do mês. */
function monthEndDate(monthStart: string): string {
  const d = new Date(`${monthStart}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
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
  generation_number: number;
  schema_version: number | null;
  has_been_shared: boolean | null;
  generated_at: Date | string;
  status: string | null;
  garden_count: number;
}

type RecapStatus = "parcial" | "final";

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
    status: (row.status ?? "parcial") as RecapStatus,
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

function resolveTag(totalMinutes: number): string {
  if (totalMinutes > 1000) return "Mestre do Foco";
  if (totalMinutes > 500) return "Guerreiro da Energia";
  if (totalMinutes > 200) return "Aprendiz Dedicada";
  return "Explorador";
}

// ─── Longest streak for a month ──────────────────────────────────────────────

/**
 * Melhor sequência DENTRO do mês (recortada na fronteira — nunca reaproveita
 * o mesmo run para dois meses consecutivos). Dias vivos = sessão de foco que
 * atingiu a duração-alvo OU dia protegido por escudo, sempre em America/Sao_Paulo.
 */
async function computeLongestStreakForMonth(
  profileId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ best: number; startDate?: string; endDate?: string; isAliveAtEnd: boolean }> {
  const today = todayIso();

  // Dias com sessão de foco qualificada dentro do mês (fuso do produto).
  const focus = await pool.query<{ day: string }>(
    `select distinct to_char((ended_at at time zone $1)::date, 'YYYY-MM-DD') as day
       from focus_sessions
      where profile_id = $2
        and ended_at is not null
        and duration_minutes * 1.0 >= target_duration_minutes * $3
        and ended_at >= $4::timestamptz
        and ended_at < $5::timestamptz`,
    [APP_TIMEZONE, profileId, STREAK_COMPLETION_THRESHOLD, spMonthStartIso(monthStart), spMonthEndIso(monthStart)],
  );
  const alive = new Set<string>(focus.rows.map((r) => r.day));

  // Dias protegidos por escudo também mantêm o streak vivo.
  const protectedDays = await pool.query<{ day: string }>(
    `select distinct to_char(used_on_date, 'YYYY-MM-DD') as day
       from streak_shield_usage
      where profile_id = $1
        and used_on_date >= $2::date
        and used_on_date < $3::date`,
    [profileId, monthStart, monthEnd],
  );
  for (const row of protectedDays.rows) alive.add(row.day);

  // longestRunInMonth itera por dias (YYYY-MM-DD), então passa o limite como data.
  return longestRunInMonth(alive, monthStart, monthEndDate(monthStart), today);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

function currentMonthStart(): string {
  return todayIso().slice(0, 7) + "-01";
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
 * Janela em America/Sao_Paulo: [primeiro instante do mês, primeiro instante do mês seguinte).
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
       AND created_at >= $2::timestamptz
       AND created_at < $3::timestamptz
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
         and started_at >= $2::timestamptz and started_at < $3::timestamptz`,
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
  const normalizedEndTier = endTier ? resolveNewTier(endTier) : undefined;
  const normalizedStartTier = startTier ? resolveNewTier(startTier) : undefined;

  const promoted =
    normalizedStartTier !== undefined &&
    normalizedEndTier !== undefined &&
    NEW_TIER_ORDER.indexOf(normalizedEndTier as NewLeagueTier) > NEW_TIER_ORDER.indexOf(normalizedStartTier as NewLeagueTier);

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
    totalXp: xpResult.totalXp,
    xpSources: xpResult.breakdown,
  };
}

async function upsertRecap(
  profileId: string,
  monthStart: string,
  summary: RecapSummary,
  status: RecapStatus = "parcial",
): Promise<MonthlyRecap> {
  // Captura o snapshot ANTES de sobrescrever, para preservar no histórico.
  const existing = await pool.query<RecapRow>(
    `SELECT * FROM monthly_recaps WHERE profile_id = $1 AND recap_month = $2`,
    [profileId, monthStart],
  );

  const result = await pool.query<RecapRow>(
    `INSERT INTO monthly_recaps (
      profile_id, recap_month, total_focus_minutes, longest_streak, streak_start_date,
      streak_end_date, streak_is_alive, league_tier, league_at_start, league_promoted,
      productivity_tag, total_xp, xp_sources, generation_number, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
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
         status = excluded.status,
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
      status,
    ],
  );

  // Save previous generation to history if this is an update (snapshot ANTES da atualização).
  if (existing.rows.length > 0) {
    const old = existing.rows[0];
    await pool.query(
      `INSERT INTO monthly_recap_history
       (recap_id, profile_id, recap_month, total_focus_minutes, longest_streak,
        streak_start_date, streak_end_date, streak_is_alive, league_at_start, league_at_end,
        league_promoted, productivity_tag, total_xp, xp_sources, generation_number, generated_at)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        old.id,
        old.profile_id,
        old.recap_month,
        old.total_focus_minutes,
        old.longest_streak,
        old.streak_start_date,
        old.streak_end_date,
        old.streak_is_alive,
        old.league_at_start,
        old.league_tier,
        old.league_promoted,
        old.productivity_tag,
        old.total_xp,
        old.xp_sources,
        old.generation_number,
        old.generated_at,
      ],
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
            r.generation_number, r.has_been_shared, r.status,
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
      // Mês em andamento: atualiza os dados ao vivo a partir da fonte,
      // mantendo o mesmo registro (status "parcial").
      const monthEnd = spMonthEndIso(monthStart);
      const summary = await buildRecapSummary(profileId, monthStart, monthEnd, true);
      output.push(await upsertRecap(profileId, monthStart, summary, "parcial"));
    } else if ((row.status ?? "parcial") !== "final") {
      // Mês encerrado ainda não finalizado: calcula uma última vez com os
      // totais completos do mês e grava como "final" (lazy finalize na leitura).
      const monthEnd = spMonthEndIso(monthStart);
      const summary = await buildRecapSummary(profileId, monthStart, monthEnd, false);
      output.push(await upsertRecap(profileId, monthStart, summary, "final"));
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
  const monthEnd = spMonthEndIso(monthStart);

  const today = todayIso();
  const currentMonth = today.slice(0, 7) + "-01";
  if (monthStart > currentMonth) {
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

  const isCurrentMonth = monthStart === currentMonth;
  const summary = await buildRecapSummary(profileId, monthStart, monthEnd, isCurrentMonth);
  return upsertRecap(profileId, monthStart, summary, isCurrentMonth ? "parcial" : "final");
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
