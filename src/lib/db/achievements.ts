import pool from "../db";
import type { AchievementProgress } from "@/types";
import { parseProfileId, ValidationError } from "./validation";
import { NotFoundError } from "../errors";
import { getLifetimeFocusMinutes } from "./focus";
import { getUserXP, creditXP } from "./xp";
import { addCoins } from "./settings";
import { ACHIEVEMENT_REWARD_TIERS, ACHIEVEMENT_REWARD_FALLBACK } from "../daily-limits";

export const ACHIEVEMENT_THRESHOLDS: Record<string, number[]> = {
  streak_master: [7, 30, 100, 365],
  deep_focus: [60, 120, 240, 520],
  early_riser: [5, 25, 100],
  sleep_champion: [10, 50, 100],
  consistency_king: [1, 10, 50],
  xp_olympian: [1000, 10000, 50000],
  social_spark: [1, 5, 20],
  rarest_aura: [1],
};

const META: Record<string, { title: string; description: string; category: string }> = {
  streak_master: { title: "Streak Master", description: "Mantenha sequências de consistência", category: "streak" },
  deep_focus: { title: "Deep Focus", description: "Acumule minutos de foco totais", category: "focus" },
  early_riser: { title: "Early Riser", description: "Faça check-in antes das 7h", category: "checkin" },
  sleep_champion: { title: "Sleep Champion", description: "Durma 7 horas ou mais", category: "sleep" },
  consistency_king: { title: "Consistency King", description: "Semanas perfeitas de check-in", category: "checkin" },
  xp_olympian: { title: "XP Olympian", description: "Acumule XP ao longo da vida", category: "focus" },
  social_spark: { title: "Social Spark", description: "Faça amigos e entre em grupos", category: "social" },
  rarest_aura: { title: "Top 1 Global", description: "Termine no topo da Liga Lendários", category: "league" },
};

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

  // Read which tiers are already claimed for this profile.
  const claimed = await pool.query<{ achievement_id: string; tier: number }>(
    `select achievement_id, tier from achievement_rewards where profile_id = $1`,
    [profileId],
  );
  const claimedKeys = new Set(claimed.rows.map((r) => `${r.achievement_id}:${r.tier}`));

  for (const id of Object.keys(ACHIEVEMENT_THRESHOLDS)) {
    const unlockedTier = tierFor(values[id] ?? 0, ACHIEVEMENT_THRESHOLDS[id]);
    for (let tier = 1; tier <= unlockedTier; tier += 1) {
      if (claimedKeys.has(`${id}:${tier}`)) continue;
      const { xp, coins } = rewardForTier(tier);
      if (xp <= 0 && coins <= 0) continue;

      const inserted = await pool.query(
        `insert into achievement_rewards (profile_id, achievement_id, tier, coins_awarded, xp_awarded)
         values ($1, $2, $3, $4, $5)
         on conflict (profile_id, achievement_id, tier) do nothing
         returning id`,
        [profileId, id, tier, coins, xp],
      );
      if (!inserted.rows[0]) continue; // claimed concurrently — skip

      if (xp > 0) {
        await creditXP(profileId, "achievement", `${id}:${tier}`, xp);
      }
      if (coins > 0) {
        await addCoins(profileId, coins);
      }
    }
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
    rarest,
  ] = await Promise.all([
    pool.query<{ current_streak: number; longest_streak: number }>(
      `select current_streak, longest_streak from profiles where id = $1`,
      [profileId],
    ),
    getLifetimeFocusMinutes(profileId),
    getUserXP(profileId),
    pool.query<{ count: string | number }>(
      `select count(*)::int as count from daily_checkins
       where profile_id = $1
         and extract(hour from created_at at time zone 'America/Sao_Paulo') < 7`,
      [profileId],
    ),
    pool.query<{ count: string | number }>(
      `select count(*)::int as count from daily_checkins
       where profile_id = $1 and sleep_hours >= 7`,
      [profileId],
    ),
    pool.query<{ count: string | number }>(
      `select count(*)::int as count from (
         select date_trunc('week', checkin_date)::date as week
         from daily_checkins
         where profile_id = $1
         group by 1
         having count(distinct checkin_date) >= 7
       ) weeks`,
      [profileId],
    ),
    pool.query<{ friends: string | number; groups: string | number }>(
      `select
         (select count(*) from friendships
          where status = 'accepted' and (requester_id = $1 or addressee_id = $1)) as friends,
         (select count(*) from group_members where profile_id = $1) as groups`,
      [profileId],
    ),
    pool.query<{ unlocked_tier: number }>(
      `select unlocked_tier from user_achievement_progress
       where profile_id = $1 and achievement_id = 'rarest_aura'`,
      [profileId],
    ),
  ]);

  const longestStreak = Math.max(
    streakRow.rows[0]?.longest_streak ?? 0,
    streakRow.rows[0]?.current_streak ?? 0,
  );

  return {
    streak_master: longestStreak,
    deep_focus: lifetimeFocus,
    early_riser: Number(earlyRiser.rows[0]?.count ?? 0),
    sleep_champion: Number(sleepChampion.rows[0]?.count ?? 0),
    consistency_king: Number(perfectWeeks.rows[0]?.count ?? 0),
    xp_olympian: userXP.totalXP,
    social_spark: Number(social.rows[0]?.friends ?? 0) + Number(social.rows[0]?.groups ?? 0),
    rarest_aura: rarest.rows[0]?.unlocked_tier ? 1 : 0,
  };
}

export async function listAchievementProgress(profileId: string): Promise<AchievementProgress[]> {
  parseProfileId(profileId);
  const values = await computeValues(profileId);

  // Award coin + XP rewards for any unlocked tiers not yet claimed (incl.
  // retroactive backfill for previously-reached requirements).
  await awardAchievementRewards(profileId, values);

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
  for (const id of Object.keys(ACHIEVEMENT_THRESHOLDS)) {
    const thresholds = ACHIEVEMENT_THRESHOLDS[id];
    const meta = META[id];
    const currentValue = values[id] ?? 0;
    const unlockedTier = tierFor(currentValue, thresholds);
    const prev = byId.get(id);
    const wasLocked = !prev || prev.unlocked_tier === 0;
    const justUnlocked = unlockedTier > 0 && (wasLocked || (prev && prev.unlocked_tier < unlockedTier && !prev.seen_at));
    const newlyUnlocked = unlockedTier > (prev?.unlocked_tier ?? 0);

    if (!prev || prev.current_value !== currentValue || newlyUnlocked) {
      await pool.query(
        `insert into user_achievement_progress
           (profile_id, achievement_id, current_value, unlocked_tier, unlocked_at, seen_at)
         values ($1, $2, $3, $4, case when $4 > 0 then now() else null end, $5)
         on conflict (profile_id, achievement_id) do update set
           current_value = excluded.current_value,
           unlocked_tier = excluded.unlocked_tier,
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
    }

    items.push({
      id,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      thresholds,
      currentValue,
      unlockedTier,
      justUnlocked: Boolean(justUnlocked && unlockedTier > 0 && !prev?.seen_at),
      unlockedAt: prev?.unlocked_at
        ? new Date(prev.unlocked_at).toISOString()
        : newlyUnlocked && unlockedTier > 0
          ? new Date().toISOString()
          : undefined,
      isFeatured: prev?.is_featured ?? false,
      featuredOrder: prev?.featured_order ?? undefined,
    });
  }

  return items;
}

export async function markAchievementSeen(profileId: string, achievementId: string): Promise<void> {
  parseProfileId(profileId);
  if (!ACHIEVEMENT_THRESHOLDS[achievementId]) throw new ValidationError("Conquista inválida.");
  const result = await pool.query(
    `update user_achievement_progress set seen_at = now()
     where profile_id = $1 and achievement_id = $2`,
    [profileId, achievementId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Conquista não encontrada.");
}

export async function unlockRarestAura(profileId: string): Promise<void> {
  parseProfileId(profileId);
  await pool.query(
    `insert into user_achievement_progress
       (profile_id, achievement_id, current_value, unlocked_tier, unlocked_at, seen_at)
     values ($1, 'rarest_aura', 1, 1, now(), null)
     on conflict (profile_id, achievement_id) do update set
       current_value = 1,
       unlocked_tier = 1,
       unlocked_at = coalesce(user_achievement_progress.unlocked_at, now()),
       seen_at = case when user_achievement_progress.unlocked_tier = 0 then null else user_achievement_progress.seen_at end`,
    [profileId],
  );
}

export async function toggleFeaturedAchievement(
  profileId: string,
  achievementId: string,
): Promise<{ isFeatured: boolean; featuredOrder?: number }> {
  parseProfileId(profileId);
  if (!ACHIEVEMENT_THRESHOLDS[achievementId]) throw new ValidationError("Conquista inválida.");

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
    await pool.query(
      `update user_achievement_progress
       set is_featured = false, featured_order = null
       where profile_id = $1 and achievement_id = $2`,
      [profileId, achievementId],
    );
    await pool.query(
      `update user_achievement_progress
       set featured_order = featured_order - 1
       where profile_id = $1 and is_featured = true and featured_order > $3`,
      [profileId, achievementId, row.featured_order ?? 0],
    );
    return { isFeatured: false };
  }

  const countResult = await pool.query<{ count: string | number }>(
    `select count(*)::int as count from user_achievement_progress
     where profile_id = $1 and is_featured = true`,
    [profileId],
  );
  const featuredCount = Number(countResult.rows[0]?.count ?? 0);
  if (featuredCount >= 5) {
    throw new ValidationError("Você já tem 5 conquistas em destaque. Remova uma primeiro.");
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
