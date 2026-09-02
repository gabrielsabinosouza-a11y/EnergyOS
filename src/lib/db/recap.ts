import pool from "../db";
import { ENERGYOS_LAUNCH_MONTH } from "@/types";
import type { MonthlyRecap } from "@/types";
import { BadRequestError } from "../errors";
import { parseProfileId } from "./validation";
import { NEW_TIER_ORDER } from "@/lib/league-new-meta";
import { addCoins } from "./settings";

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

// ─── Queries ─────────────────────────────────────────────────────────────────

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
  return result.rows.map((row) => mapRecap(profileId, row));
}

export async function generateRecap(
  profileId: string,
  monthDate: string,
): Promise<MonthlyRecap> {
  parseProfileId(profileId);
  const monthStart = resolveMonthStart(monthDate);
  const monthEnd = getMonthEnd(monthStart);

  const [focusRow, streakRow, leagueRow] = await Promise.all([
    pool.query<{ minutes: string | number }>(
      `select coalesce(sum(duration_minutes), 0) as minutes
       from focus_sessions
       where profile_id = $1 and ended_at is not null
         and started_at >= $2::date and started_at < $3::date`,
      [profileId, monthStart, monthEnd],
    ),
    pool.query<{ max_streak: string | number }>(
      `select coalesce(max(streak_value_at_use), 0) as max_streak
       from streak_shield_usage
       where profile_id = $1
         and used_on_date >= $2::date and used_on_date < $3::date`,
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
  const longestStreak = Number(streakRow.rows[0]?.max_streak ?? 0);
  // Normaliza para o sistema atual; se o valor não for um tier válido, descarta.
  const rawTier = leagueRow.rows[0]?.tier ?? undefined;
  const tier = rawTier && NEW_TIER_ORDER.includes(rawTier.toUpperCase() as typeof NEW_TIER_ORDER[number])
    ? rawTier.toUpperCase()
    : undefined;
  const promoted = false;

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
    [profileId, monthStart, totalMinutes, longestStreak, tier ?? null, promoted, resolveTag(totalMinutes)],
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

// ── Share tracking & reward ────────────────────────────────────────────────────────

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
    wasFirstShare: false 
  };
}