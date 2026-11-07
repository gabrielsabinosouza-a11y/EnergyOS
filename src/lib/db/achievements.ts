import pool from "../db";
import type { PoolClient } from "pg";
import type { AchievementProgress } from "@/types";
import { parseProfileId, ValidationError } from "./validation";
import { NotFoundError } from "../errors";
import { getUserXP, creditXP } from "./xp";
import { addCoins } from "./settings";
import { ACHIEVEMENT_REWARD_TIERS, ACHIEVEMENT_REWARD_FALLBACK, STREAK_COMPLETION_THRESHOLD } from "../daily-limits";
import { ENERGY_TYPES } from "../energy-assets";
import { getOwnedAuras } from "./store";
import { APP_TIMEZONE } from "./dates";
import { STREAK_TIERS, streakTierForValue } from "../streak-tiers";

export const ACHIEVEMENT_THRESHOLDS: Record<string, number[]> = {
  streak_master: [...STREAK_TIERS],
  deep_focus: [60, 120, 240, 520],
  early_riser: [5, 25, 100],
  sleep_champion: [10, 50, 100],
  consistency_king: [1, 10, 30],
  xp_olympian: [1000, 10000, 30000],
  social_spark: [1, 5, 20],
  top_1_global: [1],
  squad_leader: [3, 10, 20, 35],
  focus_companion: [1, 5, 10, 30],
  flow_state: [90, 120],
};

const META: Record<string, { title: string; description: string; category: string }> = {
  streak_master: { title: "Mestre da Sequência", description: "Mantenha sequências de consistência", category: "streak" },
  deep_focus: { title: "Foco Profundo", description: "Acumule minutos de foco totais", category: "focus" },
  early_riser: { title: "Madrugador", description: "Faça check-in antes das 7h", category: "checkin" },
  sleep_champion: { title: "Campeão do Sono", description: "Durma 7 horas ou mais", category: "sleep" },
  consistency_king: { title: "Rei da Consistência", description: "Semanas perfeitas de foco", category: "checkin" },
  xp_olympian: { title: "Olimpiano de XP", description: "Acumule XP ao longo da vida", category: "focus" },
  social_spark: { title: "Faísca Social", description: "Faça amigos e entre em grupos", category: "social" },
  top_1_global: { title: "Top 1 Global", description: "Termine em 1º lugar na Liga Lendas", category: "league" },
  squad_leader: { title: "Líder de Esquadrão", description: "Tenha o maior grupo onde você é dono", category: "social" },
  focus_companion: { title: "Companheiro de Foco", description: "Conclua sessões focando com outras pessoas", category: "focus" },
  flow_state: { title: "Estado de Fluxo", description: "Complete uma sessão de foco ininterrupta", category: "focus" },
  aura_collector: { title: "Colecionador de Auras", description: "Colecione uma porcentagem das auras disponíveis", category: "aura" },
};

const AURA_COLLECTOR_ID = "aura_collector";

/** Total de auras que existem no jogo hoje — lido ao vivo a cada avaliação, para que adicionar auras no futuro não exija mudanças aqui. */
function totalAvailableAuras(): number {
  return ENERGY_TYPES.length;
}

/** 25% / 50% / 100% do total de auras vigente, sempre arredondado para cima (para os degraus nunca ficarem fáceis demais). */
function auraCollectorThresholds(): number[] {
  const total = totalAvailableAuras();
  return [Math.ceil(total * 0.25), Math.ceil(total * 0.5), total];
}

/** Todos os ids de conquistas, incluindo o colecionador de auras com degraus dinâmicos. */
const ALL_ACHIEVEMENT_IDS = [...Object.keys(ACHIEVEMENT_THRESHOLDS), AURA_COLLECTOR_ID];

function thresholdsFor(id: string): number[] {
  return id === AURA_COLLECTOR_ID ? auraCollectorThresholds() : ACHIEVEMENT_THRESHOLDS[id];
}

function tierFor(value: number, thresholds: number[]): number {
  let tier = 0;
  for (const threshold of thresholds) {
    if (value >= threshold) tier += 1;
    else break;
  }
  return tier;
}

/** Reward (coin + XP) for a 1-based unlocked tier. Harder tiers pay more. */
function rewardForTier(tier: number): { xp: number; coins: number } {
  if (tier <= 0) return { xp: 0, coins: 0 };
  return ACHIEVEMENT_REWARD_TIERS[tier - 1] ?? ACHIEVEMENT_REWARD_FALLBACK;
}

/**
 * Mints the coin + XP reward for every unlocked achievement tier that hasn't
 * been claimed yet. Idempotent: the `achievement_rewards` unique constraint on
 * (profile_id, achievement_id, tier) guarantees each tier is rewarded exactly
 * once, even with repeated/backfilled evaluations.
 */
export async function awardAchievementRewards(
  profileId: string,
  values: Record<string, number>,
): Promise<void> {
  parseProfileId(profileId);

  const client: PoolClient = await pool.connect();
  try {
    await client.query("begin");

    // Read which tiers are already claimed for this profile.
    const claimed = await client.query<{ achievement_id: string; tier: number }>(
      `select achievement_id, tier from achievement_rewards where profile_id = $1`,
      [profileId],
    );
    const claimedKeys = new Set(claimed.rows.map((r) => `${r.achievement_id}:${r.tier}`));

    for (const id of ALL_ACHIEVEMENT_IDS) {
      if (id === "top_1_global") continue;
      const unlockedTier = tierFor(values[id] ?? 0, thresholdsFor(id));
      for (let tier = 1; tier <= unlockedTier; tier += 1) {
        if (claimedKeys.has(`${id}:${tier}`)) continue;
        const { xp, coins } = rewardForTier(tier);
        if (xp <= 0 && coins <= 0) continue;

        try {
          const inserted = await client.query(
            `insert into achievement_rewards (profile_id, achievement_id, tier, coins_awarded, xp_awarded)
             values ($1, $2, $3, $4, $5)
             on conflict (profile_id, achievement_id, tier) do nothing
             returning id`,
            [profileId, id, tier, coins, xp],
          );
          if (!inserted.rows[0]) continue; // claimed concurrently — skip

          if (xp > 0) {
            await creditXP(profileId, "achievement", `${id}:${tier}`, xp, { db: client });
          }
          if (coins > 0) {
            await addCoins(profileId, coins, client);
          }
        } catch (error) {
          // Missing achievement_rewards table (42P01), missing FK target row
          // (23503), or schema drift must not abort rewarding other tiers.
          const pg = error as { code?: string; message?: string; constraint?: string };
          const ignorable = pg.code === "42P01" || pg.code === "23503" || pg.code === "42703"
            || (pg.message?.includes("column") && pg.message?.includes("does not exist"));
          if (ignorable) {
            console.error(`[achievements] Recompensa ignorada para "${id}" tier ${tier}:`, pg.message ?? pg.code);
            continue;
          }
          throw error;
        }
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs one achievement-value query in isolation. A single broken query (e.g. a
 * column that hasn't been migrated in the live DB) must NEVER blank the whole
 * achievements list — the failing achievement logs loudly and evaluates to 0,
 * while every other achievement keeps working.
 */
async function safeQuery<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    console.error(
      `[achievements] Falha ao calcular "${name}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function computeValues(profileId: string): Promise<Record<string, number>> {
  const [
    streakRow,
    lifetimeFocus,
    userXP,
    earlyRiser,
    sleepChampion,
    perfectWeeks,
    social,
    squadLeader,
    focusCompanion,
    flowState,
    ownedAuras,
    top1Global,
  ] = await Promise.all([
    safeQuery("streak_master", () =>
      pool.query<{ current_streak: number; longest_streak: number; saved_best_streak: number }>(
        `select p.current_streak, p.longest_streak,
                coalesce(uap.current_value, 0) as saved_best_streak
         from profiles p
         left join user_achievement_progress uap
           on uap.profile_id = p.id and uap.achievement_id = 'streak_master'
         where p.id = $1`,
        [profileId],
      ),
    ),
    safeQuery("deep_focus", () =>
      pool.query<{ minutes: string | number }>(
        `select coalesce(sum(duration_minutes), 0) as minutes
         from focus_session_events where profile_id = $1`,
        [profileId],
      ),
    ),
    safeQuery("xp_olympian", () => getUserXP(profileId)),
    safeQuery("early_riser", () =>
      pool.query<{ count: string | number }>(
        `select count(*)::int as count from daily_checkins
         where profile_id = $1
           and extract(hour from created_at at time zone 'America/Sao_Paulo') < 7`,
        [profileId],
      ),
    ),
    safeQuery("sleep_champion", () =>
      pool.query<{ count: string | number }>(
        `select count(*)::int as count from daily_checkins
         where profile_id = $1 and sleep_hours >= 7`,
        [profileId],
      ),
    ),
    safeQuery("consistency_king", () =>
      pool.query<{ count: string | number }>(
        `select count(*)::int as count from (
           select week_start
           from (
             select (ended_at at time zone $2)::date as day,
                    (ended_at at time zone $2)::date
                      - extract(dow from (ended_at at time zone $2)::date)::int as week_start
             from focus_sessions
             where profile_id = $1
               and ended_at is not null
               and duration_minutes * 1.0 >= target_duration_minutes * $3
           ) days
           group by week_start
           having count(distinct day) = 7
              and not exists (
                select 1 from streak_shield_usage u
                where u.profile_id = $1
                  and u.used_on_date >= week_start
                  and u.used_on_date < week_start + 7
              )
         ) perfect_weeks`,
        [profileId, APP_TIMEZONE, STREAK_COMPLETION_THRESHOLD],
      ),
    ),
    safeQuery("social_spark", () =>
      pool.query<{ friends: string | number; groups: string | number }>(
        `select
           (select count(*) from friendships
            where status = 'accepted' and (requester_id = $1 or addressee_id = $1)) as friends,
           (select count(*) from group_members where profile_id = $1) as groups`,
        [profileId],
      ),
    ),
    
    
    safeQuery("squad_leader", () =>
      pool.query<{ largest: string | number }>(
        `select max(cnt) as largest from (
           select gm.group_id, count(*) as cnt
           from group_members gm
           where coalesce(gm.is_banned, false) = false
             and gm.group_id in (
               select group_id from group_members
               where profile_id = $1 and role = 'OWNER' and coalesce(is_banned, false) = false
             )
           group by gm.group_id
         ) owned`,
        [profileId],
      ),
    ),
    safeQuery("focus_companion", () =>
      pool.query<{ current_value: number }>(
        `select greatest(
           coalesce((
             select count(*)::int
             from focus_session_events
             where profile_id = $1 and is_completed = true and participant_count >= 2
           ), 0),
           coalesce((
             select count(*)::int
             from achievement_progress_events
             where profile_id = $1 and achievement_id = 'focus_companion'
           ), 0),
           coalesce((
             select current_value
             from user_achievement_progress
             where profile_id = $1 and achievement_id = 'focus_companion'
           ), 0)
         ) as current_value`,
        [profileId],
      ),
    ),
    safeQuery("flow_state", () =>
      pool.query<{ longest: string | number }>(
        `select coalesce(max(duration_minutes), 0) as longest
         from focus_session_events
         where profile_id = $1
           and paused_count = 0`,
        [profileId],
      ),
    ),
    safeQuery("aura_collector", () => getOwnedAuras(profileId)),
    safeQuery("top_1_global", () =>
      pool.query<{ times_top_1_global: number }>(
        `select times_top_1_global from profiles where id = $1`,
        [profileId],
      ),
    ),
  ]);

  const longestStreak = Math.max(
    streakRow?.rows[0]?.longest_streak ?? 0,
    streakRow?.rows[0]?.current_streak ?? 0,
    streakRow?.rows[0]?.saved_best_streak ?? 0,
  );

  const knownAuraTypes = new Set<string>(ENERGY_TYPES);

  return {
    streak_master: longestStreak,
    deep_focus: Number(lifetimeFocus?.rows?.[0]?.minutes ?? 0),
    early_riser: Number(earlyRiser?.rows[0]?.count ?? 0),
    sleep_champion: Number(sleepChampion?.rows[0]?.count ?? 0),
    consistency_king: Number(perfectWeeks?.rows[0]?.count ?? 0),
    xp_olympian: userXP?.totalXP ?? 0,
    social_spark: Number(social?.rows[0]?.friends ?? 0) + Number(social?.rows[0]?.groups ?? 0),
    top_1_global: Number(top1Global?.rows[0]?.times_top_1_global ?? 0),
    squad_leader: Number(squadLeader?.rows[0]?.largest ?? 0),
    focus_companion: Number(focusCompanion?.rows[0]?.current_value ?? 0),
    flow_state: Number(flowState?.rows[0]?.longest ?? 0),
    aura_collector: (ownedAuras ?? []).filter((type) => knownAuraTypes.has(type)).length,
  };
}

export async function listAchievementProgress(profileId: string): Promise<AchievementProgress[]> {
  parseProfileId(profileId);
  const [values, top1GlobalWeek] = await Promise.all([
    computeValues(profileId),
    safeQuery("top_1_global_week", () =>
      pool.query<{ last_top_1_global_week: Date | string | null }>(
        `select last_top_1_global_week from profiles where id = $1`,
        [profileId],
      ),
    ),
  ]);
  const lastTop1GlobalWeek = top1GlobalWeek?.rows[0]?.last_top_1_global_week;

  // Award coin + XP rewards for any unlocked tiers not yet claimed (incl.
  // retroactive backfill for previously-reached requirements). Best-effort:
  // a missing achievement_rewards table / FK drift must not 500 the whole
  // achievements response (progress is the primary data).
  try {
    await awardAchievementRewards(profileId, values);
  } catch (error) {
    const pg = error as { message?: string; code?: string; detail?: string; table?: string; constraint?: string };
    console.error("[achievements] Falha ao creditar recompensas (progresso preservado):", {
      message: pg.message ?? (error instanceof Error ? error.message : String(error)),
      code: pg.code,
      detail: pg.detail,
      table: pg.table,
      constraint: pg.constraint,
    });
  }

  const lockedIds = ALL_ACHIEVEMENT_IDS.filter(
    (id) =>
      (id === "streak_master"
        ? streakTierForValue(values[id] ?? 0)
        : tierFor(values[id] ?? 0, thresholdsFor(id))) === 0,
  );
  if (lockedIds.length > 0) {
    await pool.query(
      `update user_achievement_progress
       set is_featured = false, featured_order = null
       where profile_id = $1
         and achievement_id = any($2::text[])
         and is_featured = true`,
      [profileId, lockedIds],
    );
  }

  const existing = await pool.query<{
    achievement_id: string;
    current_value: number;
    unlocked_tier: number;
    seen_at: Date | string | null;
    unlocked_at: Date | string | null;
    is_featured: boolean;
    featured_order: number | null;
  }>(
    `select achievement_id, current_value, unlocked_tier, seen_at, unlocked_at, is_featured, featured_order
     from user_achievement_progress where profile_id = $1`,
    [profileId],
  );
  const byId = new Map(existing.rows.map((row) => [row.achievement_id, row]));

  const items: AchievementProgress[] = [];
  for (const id of ALL_ACHIEVEMENT_IDS) {
    const thresholds = thresholdsFor(id);
    const meta = META[id];
    const prev = byId.get(id);
    // Event-backed achievements are append-only. Never let a stale runtime
    // calculation lower a value already persisted in the progress row.
    const currentValue = ["focus_companion", "deep_focus", "flow_state", "top_1_global"].includes(id)
      ? Math.max(values[id] ?? 0, prev?.current_value ?? 0)
      : values[id] ?? 0;
    const unlockedTier = id === "streak_master"
      ? streakTierForValue(currentValue)
      : tierFor(currentValue, thresholds);
    const newlyUnlocked = unlockedTier > (prev?.unlocked_tier ?? 0);
    // An achievement is surfaced in the unlock modal when its tier just rose in
    // this evaluation — first unlock (0→1) OR a level-up of an already-seen tier
    // (e.g. 2→3). The older guard `&& !prev.seen_at` silently swallowed level-ups
    // because a previously-dismissed tier leaves seen_at set. The upsert below
    // resets seen_at to null whenever the tier increases, so the new tier is
    // surfaced exactly once; `!prev.seen_at` additionally re-surfaces a tier that
    // was unlocked but never confirmed (e.g. tab refreshed before dismiss).
    const justUnlocked = unlockedTier > 0 && (newlyUnlocked || !prev?.seen_at);

    if (!prev || prev.current_value !== currentValue || newlyUnlocked) {
      try {
        await pool.query(
          `insert into user_achievement_progress
             (profile_id, achievement_id, current_value, unlocked_tier, unlocked_at, seen_at)
           values ($1, $2, $3, $4, case when $4 > 0 then now() else null end, $5)
           on conflict (profile_id, achievement_id) do update set
             current_value = case
               when excluded.achievement_id = 'top_1_global'
                 then greatest(user_achievement_progress.current_value, excluded.current_value)
               else excluded.current_value
             end,
             unlocked_tier = case
               when excluded.achievement_id = 'top_1_global'
                 then greatest(user_achievement_progress.unlocked_tier, excluded.unlocked_tier)
               else excluded.unlocked_tier
             end,
             unlocked_at = case
               when user_achievement_progress.unlocked_tier = 0 and excluded.unlocked_tier > 0 then now()
               when excluded.unlocked_tier > user_achievement_progress.unlocked_tier then now()
               else user_achievement_progress.unlocked_at
             end,
             seen_at = case
               when excluded.unlocked_tier > user_achievement_progress.unlocked_tier then null
               else user_achievement_progress.seen_at
             end`,
          [profileId, id, currentValue, unlockedTier, prev?.seen_at ?? null],
        );
      } catch (error) {
        // One broken achievement (e.g. missing achievements FK row / schema drift)
        // must not fail the whole request — skip it and return the rest.
        // This includes FK errors (achievement_id not in achievements table) and
        // schema drift errors (missing columns in user_achievement_progress).
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isFKError = errorMsg.includes("user_achievement_progress_achievement_id_fkey") ||
                          errorMsg.includes("23503");
        const isSchemaError = errorMsg.includes("column") && errorMsg.includes("does not exist");
        if (isFKError || isSchemaError) {
          console.error(
            `[achievements] Falha ao persistir progresso "${id}" (ignorado): ${errorMsg}`,
          );
          continue;
        }
        // Re-throw unexpected errors
        throw error;
      }
    }

    items.push({
      id,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      thresholds,
      currentValue,
      unlockedTier,
      previousTier: id === "top_1_global" && !prev?.seen_at
        ? 0
        : prev?.unlocked_tier ?? 0,
      justUnlocked: Boolean(justUnlocked && unlockedTier > 0),
      unlockedAt: prev?.unlocked_at
        ? new Date(prev.unlocked_at).toISOString()
        : newlyUnlocked && unlockedTier > 0
          ? new Date().toISOString()
          : undefined,
      isFeatured: prev?.is_featured ?? false,
      featuredOrder: prev?.featured_order ?? undefined,
      lastTop1GlobalWeek: id === "top_1_global" && lastTop1GlobalWeek
        ? typeof lastTop1GlobalWeek === "string"
          ? lastTop1GlobalWeek.slice(0, 10)
          : lastTop1GlobalWeek.toISOString().slice(0, 10)
        : undefined,
    });
  }

  // Loud guard: the achievement definitions are the source of truth. If the
  // returned list is ever empty or shorter than defined, something went very
  // wrong (dropped definition, broken query). Never let that ship silently.
  if (items.length === 0) {
    console.error("[achievements] Lista de conquistas VAZIA — há definições carregadas mas nenhuma retornou. Verifique ACHIEVEMENT_THRESHOLDS/META.");
  } else if (items.length !== ALL_ACHIEVEMENT_IDS.length) {
    const missing = ALL_ACHIEVEMENT_IDS.filter((id) => !items.some((i) => i.id === id));
    console.error(
      `[achievements] Lista incompleta: esperava ${ALL_ACHIEVEMENT_IDS.length} conquistas, retornou ${items.length}. Ausentes: ${missing.join(", ")}`,
    );
  }

  return items;
}

export async function markAchievementSeen(profileId: string, achievementId: string): Promise<void> {
  parseProfileId(profileId);
  if (!META[achievementId]) throw new ValidationError("Conquista inválida.");
  const result = await pool.query(
    `update user_achievement_progress set seen_at = now()
     where profile_id = $1 and achievement_id = $2`,
    [profileId, achievementId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Conquista não encontrada.");
}


export async function toggleFeaturedAchievement(
  profileId: string,
  achievementId: string,
): Promise<{ isFeatured: boolean; featuredOrder?: number }> {
  parseProfileId(profileId);
  if (!META[achievementId]) throw new ValidationError("Conquista inválida.");

  const current = await pool.query<{
    is_featured: boolean;
    featured_order: number | null;
    unlocked_tier: number;
  }>(
    `select is_featured, featured_order, unlocked_tier
     from user_achievement_progress
     where profile_id = $1 and achievement_id = $2`,
    [profileId, achievementId],
  );

  const row = current.rows[0];
  if (!row || row.unlocked_tier === 0) {
    throw new ValidationError("Só é possível destaque conquistas desbloqueadas.");
  }

  if (row.is_featured) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `update user_achievement_progress
         set is_featured = false, featured_order = null
         where profile_id = $1 and achievement_id = $2`,
        [profileId, achievementId],
      );
      await client.query(
        `update user_achievement_progress
         set featured_order = featured_order - 1
         where profile_id = $1 and is_featured = true and featured_order > $2`,
        [profileId, row.featured_order ?? 0],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    return { isFeatured: false };
  }

  const countResult = await pool.query<{ count: string | number }>(
    `select count(*)::int as count from user_achievement_progress
     where profile_id = $1 and is_featured = true`,
    [profileId],
  );
  const featuredCount = Number(countResult.rows[0]?.count ?? 0);
  if (featuredCount >= 6) {
    throw new ValidationError("Você já tem 6 conquistas em destaque. Remova uma primeiro.");
  }

  const nextOrder = featuredCount + 1;
  await pool.query(
    `update user_achievement_progress
     set is_featured = true, featured_order = $3
     where profile_id = $1 and achievement_id = $2`,
    [profileId, achievementId, nextOrder],
  );
  return { isFeatured: true, featuredOrder: nextOrder };
}
