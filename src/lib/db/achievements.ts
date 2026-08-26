import pool from "../db";
import type { AchievementProgress } from "@/types";
import { parseProfileId, ValidationError } from "./validation";
import { NotFoundError } from "../errors";
import { getLifetimeFocusMinutes, getLongestFocusSession } from "./focus";

export const ACHIEVEMENT_THRESHOLDS: Record<string, number[]> = {
  streak_master: [7, 30, 100, 365],
  deep_focus: [25, 60, 120, 240],
  early_riser: [5, 25, 100],
  sleep_champion: [10, 50, 100],
  consistency_king: [1, 10, 50],
  xp_olympian: [1000, 10000, 50000],
  social_spark: [1, 5, 20],
  rarest_aura: [1],
};

const META: Record<string, { title: string; description: string; category: string }> = {
  streak_master: { title: "Streak Master", description: "Mantenha sequências de consistência", category: "streak" },
  deep_focus: { title: "Deep Focus", description: "Complete sessões longas de foco", category: "focus" },
  early_riser: { title: "Early Riser", description: "Faça check-in antes das 7h", category: "checkin" },
  sleep_champion: { title: "Sleep Champion", description: "Durma 7 horas ou mais", category: "sleep" },
  consistency_king: { title: "Consistency King", description: "Semanas perfeitas de check-in", category: "checkin" },
  xp_olympian: { title: "XP Olympian", description: "Acumule minutos de foco ao longo da vida", category: "focus" },
  social_spark: { title: "Social Spark", description: "Faça amigos e entre em grupos", category: "social" },
  rarest_aura: { title: "Rarest Aura", description: "Termine no topo da liga Núcleo", category: "league" },
};

function tierFor(value: number, thresholds: number[]): number {
  let tier = 0;
  for (const threshold of thresholds) {
    if (value >= threshold) tier += 1;
    else break;
  }
  return tier;
}

async function computeValues(profileId: string): Promise<Record<string, number>> {
  const [
    streakRow,
    longestFocus,
    lifetimeFocus,
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
    getLongestFocusSession(profileId),
    getLifetimeFocusMinutes(profileId),
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
    deep_focus: longestFocus,
    early_riser: Number(earlyRiser.rows[0]?.count ?? 0),
    sleep_champion: Number(sleepChampion.rows[0]?.count ?? 0),
    consistency_king: Number(perfectWeeks.rows[0]?.count ?? 0),
    xp_olympian: lifetimeFocus,
    social_spark: Number(social.rows[0]?.friends ?? 0) + Number(social.rows[0]?.groups ?? 0),
    rarest_aura: rarest.rows[0]?.unlocked_tier ? 1 : 0,
  };
}

export async function listAchievementProgress(profileId: string): Promise<AchievementProgress[]> {
  parseProfileId(profileId);
  const values = await computeValues(profileId);
  const existing = await pool.query<{
    achievement_id: string;
    current_value: number;
    unlocked_tier: number;
    seen_at: Date | string | null;
    unlocked_at: Date | string | null;
  }>(
    `select achievement_id, current_value, unlocked_tier, seen_at, unlocked_at
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
