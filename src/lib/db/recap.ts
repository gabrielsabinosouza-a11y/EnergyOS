import pool from "../db";
import { ENERGYOS_LAUNCH_MONTH } from "@/types";
import type { MonthlyRecap } from "@/types";
import { BadRequestError } from "../errors";
import { parseProfileId } from "./validation";
import { NEW_TIER_ORDER } from "@/lib/league-new-meta";
import { addCoins } from "./settings";
import { STREAK_COMPLETION_THRESHOLD } from "@/lib/daily-limits";
import { APP_TIMEZONE, addDaysIso, todayIso } from "./dates";

// ─── Row mapping ─────────────────────────────────────────────────────────────

interface RecapRow {
  id: number;
  recap_month: Date | string;
  total_focus_minutes: number;
  longest_streak: number;
  league_tier: string | null;
  league_promoted: boolean | null;
  productivity_tag: string | null;
  garden_count: number;
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
    leagueTier: row.league_tier ?? undefined,
    leaguePromoted: row.league_promoted ?? undefined,
    productivityTag: row.productivity_tag ?? undefined,
    gardenCount: Number(row.garden_count) || 0,
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
  if (totalMinutes > 200) return "Aprendiz Dedicado";
  return "Explorador";
}

// ─── Longest streak for a month ──────────────────────────────────────────────

/**
 * Retorna o maior run de dias consecutivos "vivos" (uma sessão de foco que
 * atingiu a duração-alvo OU um dia protegido por escudo) que contenha ao menos
 * um dia dentro de [monthStart, monthEnd).
 *
 * Espelha a semântica de `calculateStreak`: hoje não conta como "buraco" antes
 * de terminar — se hoje ainda não foi qualificado, o run de ontem é preservado.
 *
 * OBS: os dias "vivos" vêm dos dados reais (focus_sessions + streak_shield_usage),
 * NÃO de `streak_shield_usage.streak_value_at_use`, que só existia quando um
 * escudo era consumido e por isso subestimava (ou zerava) o streak de quem
 * mantinha a sequência sem usar escudos.
 */
async function computeLongestStreakForMonth(
  profileId: string,
  monthStart: string,
  monthEnd: string,
): Promise<number> {
  const today = todayIso();
  // Janela estendida antes do mês para capturar runs que começaram no mês
  // anterior e continuam dentro do mês alvo. 400 dias espelha a janela de
  // histórico do próprio sistema de streak (`computeStreak`), garantindo que
  // nenhuma sequência longa seja truncada na borda da janela.
  const windowStart = addDaysIso(monthStart, -400);
  const windowEnd = addDaysIso(monthEnd, 400);

  // 1) Dias com sessão de foco qualificada (mesmo predicado do streak).
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

  // 2) Dias protegidos por escudo também mantêm o streak vivo.
  const protectedDays = await pool.query<{ day: string }>(
    `select distinct to_char(used_on_date, 'YYYY-MM-DD') as day
       from streak_shield_usage
      where profile_id = $1
        and used_on_date >= $2::date
        and used_on_date < $3::date`,
    [profileId, windowStart, windowEnd],
  );
  for (const row of protectedDays.rows) alive.add(row.day);

  // 3) Percorre dia a dia acumulando runs. Um run só é considerado "dentro do
  //    mês" se algum de seus dias cai em [monthStart, monthEnd). Hoje não
  //    qualificado não quebra o run (o dia ainda está em andamento).
  let best = 0;
  let run = 0;
  let runTouchesMonth = false;
  for (
    let cursor = windowStart;
    cursor < windowEnd;
    cursor = addDaysIso(cursor, 1)
  ) {
    const inMonth = cursor >= monthStart && cursor < monthEnd;
    if (inMonth) runTouchesMonth = true;

    const isAlive = alive.has(cursor);
    const isOpenToday = cursor === today && !isAlive;

    if (isAlive) {
      run += 1;
    } else if (isOpenToday) {
      if (run > best && runTouchesMonth) best = run;
    } else {
      if (run > best && runTouchesMonth) best = run;
      run = 0;
      runTouchesMonth = false;
    }
  }
  if (run > best && runTouchesMonth) best = run;
  return best;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Primeiro dia do mês corrente no fuso do produto (YYYY-MM-01). */
function currentMonthStart(): string {
  return todayIso().slice(0, 7) + "-01";
}

/** Instante UTC (ISO) em que o mês termina (primeiro dia do mês seguinte, 00:00 em São Paulo). */
function monthEndUtcIso(monthStart: string): string {
  const endDay = getMonthEnd(monthStart);
  return new Date(`${endDay}T00:00:00-03:00`).toISOString();
}

interface RecapSummary {
  totalFocusMinutes: number;
  longestStreak: number;
  leagueTier?: string;
  promoted: boolean;
}

async function buildRecapSummary(
  profileId: string,
  monthStart: string,
  monthEnd: string,
): Promise<RecapSummary> {
  const [focusRow, leagueRow] = await Promise.all([
    pool.query<{ minutes: string | number }>(
      `select coalesce(sum(duration_minutes), 0) as minutes
       from focus_sessions
       where profile_id = $1 and ended_at is not null
         and started_at >= $2::date and started_at < $3::date`,
      [profileId, monthStart, monthEnd],
    ),
    // Tier do mês: usamos o sistema ATUAL (league_groups / league_group_members),
    // não o legado league_entries. Primeiro tentamos o grupo histórico daquele
    // mês; se não houver (sem histórico semanal), caímos no grupo mais recente.
    pool.query<{ tier: string | null }>(
      `select lg.tier
       from league_group_members lgm
       join league_groups lg on lg.id = lgm.league_group_id
       where lgm.profile_id = $1
         and lg.week_start_date >= $2::date
         and lg.week_start_date < $3::date
       order by lg.week_start_date desc
       limit 1`,
      [profileId, monthStart, monthEnd],
    ).then(async (hist) => {
      if (hist.rows[0]?.tier) return hist;
      const latest = await pool.query<{ tier: string | null }>(
        `select lg.tier
         from league_group_members lgm
         join league_groups lg on lg.id = lgm.league_group_id
         where lgm.profile_id = $1
         order by lg.week_start_date desc
         limit 1`,
        [profileId],
      );
      return latest;
    }),
  ]);

  const totalMinutes = Number(focusRow.rows[0]?.minutes ?? 0);
  const longestStreak = await computeLongestStreakForMonth(profileId, monthStart, monthEnd);
  // Normaliza para o sistema atual; se o valor não for um tier válido, descarta.
  const rawTier = leagueRow.rows[0]?.tier ?? undefined;
  const leagueTier = rawTier && NEW_TIER_ORDER.includes(rawTier.toUpperCase() as typeof NEW_TIER_ORDER[number])
    ? rawTier.toUpperCase()
    : undefined;

  return { totalFocusMinutes: totalMinutes, longestStreak, leagueTier, promoted: false };
}

async function upsertRecap(
  profileId: string,
  monthStart: string,
  summary: RecapSummary,
): Promise<MonthlyRecap> {
  const result = await pool.query<RecapRow>(
    `insert into monthly_recaps
       (profile_id, recap_month, total_focus_minutes, longest_streak, league_tier, league_promoted, productivity_tag)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (profile_id, recap_month) do update set
       total_focus_minutes = excluded.total_focus_minutes,
       longest_streak = excluded.longest_streak,
       league_tier = excluded.league_tier,
       league_promoted = excluded.league_promoted,
       productivity_tag = excluded.productivity_tag,
       generated_at = now()
     returning id, recap_month, total_focus_minutes, longest_streak, league_tier, league_promoted, productivity_tag, generated_at`,
    [
      profileId,
      monthStart,
      summary.totalFocusMinutes,
      summary.longestStreak,
      summary.leagueTier ?? null,
      summary.promoted,
      resolveTag(summary.totalFocusMinutes),
    ],
  );

  // Conta as energias/auras plantadas no jardim ao longo do mesmo ano do recap.
  const gardenRow = await pool.query<{ count: string | number }>(
    `select count(*) as count
     from garden_entries
     where profile_id = $1
       and date_trunc('year', planted_at) = date_trunc('year', $2::date)`,
    [profileId, monthStart],
  );

  const recapRow = result.rows[0];
  return {
    ...mapRecap(profileId, recapRow),
    gardenCount: Number(gardenRow.rows[0]?.count ?? 0) || 0,
  };
}

export async function getRecaps(profileId: string): Promise<MonthlyRecap[]> {
  parseProfileId(profileId);
  const result = await pool.query<RecapRow>(
    `select r.id, r.recap_month, r.total_focus_minutes, r.longest_streak, r.league_tier,
            r.league_promoted, r.productivity_tag, r.has_been_shared, r.generated_at,
            (select count(*) from garden_entries g
             where g.profile_id = r.profile_id
               and date_trunc('year', g.planted_at) = date_trunc('year', r.recap_month)) as garden_count
     from monthly_recaps r
     where r.profile_id = $1 and r.recap_month >= $2::date
     order by r.recap_month desc`,
    [profileId, ENERGYOS_LAUNCH_MONTH],
  );

  const currentMonth = currentMonthStart();

  const output: MonthlyRecap[] = [];
  for (const row of result.rows) {
    const monthStart =
      typeof row.recap_month === "string" ? row.recap_month : row.recap_month.toISOString().slice(0, 10);
    if (monthStart === currentMonth) {
      // Mês corrente: dados atualizados ao vivo a cada visualização.
      const monthEnd = getMonthEnd(monthStart);
      const summary = await buildRecapSummary(profileId, monthStart, monthEnd);
      output.push(await upsertRecap(profileId, monthStart, summary));
    } else {
      // Mês fechado: se foi gerado antes do fim do mês (ficou "congelado" com
      // dados parciais), finaliza UMA vez com os dados finais do mês. Depois
      // disso o snapshot fica travado.
      const generatedAt = new Date(row.generated_at).toISOString();
      const isClosedMonth = monthStart < currentMonth;
      const needsFinalize = isClosedMonth && generatedAt < monthEndUtcIso(monthStart);
      if (needsFinalize) {
        const monthEnd = getMonthEnd(monthStart);
        const summary = await buildRecapSummary(profileId, monthStart, monthEnd);
        output.push(await upsertRecap(profileId, monthStart, summary));
      } else {
        output.push(mapRecap(profileId, row));
      }
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

  const summary = await buildRecapSummary(profileId, monthStart, monthEnd);
  return upsertRecap(profileId, monthStart, summary);
}

// ─── Share tracking & reward ────────────────────────────────────────────────

const SHARE_REWARD_COINS = 50;

export async function markRecapShared(profileId: string, recapId: number): Promise<{ newBalance: number; wasFirstShare: boolean }> {
  parseProfileId(profileId);

  const result = await pool.query<{ has_been_shared: boolean | null; }>(
    `update monthly_recaps
     set has_been_shared = true
     where id = $1 and profile_id = $2 and has_been_shared = false
     returning has_been_shared`,
    [recapId, profileId],
  );

  const wasFirstShare = (result.rowCount ?? 0) > 0;

  if (wasFirstShare) {
    // Award coins for first share
    const settings = await addCoins(profileId, SHARE_REWARD_COINS);
    return { newBalance: settings.coins, wasFirstShare: true };
  }

  // Return current balance (no change)
  const currentBalance = await pool.query<{ coins: number }>(
    `select coins from user_settings where profile_id = $1`,
    [profileId],
  );

  return {
    newBalance: currentBalance.rows[0]?.coins ?? 0,
    wasFirstShare: false,
  };
}