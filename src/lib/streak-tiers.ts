export const STREAK_TIERS = [7, 14, 30, 100] as const;

export function streakTierForValue(value: number): number {
  return STREAK_TIERS.filter((threshold) => value >= threshold).length;
}

/** Converts a saved tier index from the retired 7/30/100/top-tier definition. */
export function legacyStreakValue(unlockedTier: number): number {
  if (unlockedTier >= 3) return STREAK_TIERS[3];
  if (unlockedTier === 2) return STREAK_TIERS[2];
  if (unlockedTier === 1) return STREAK_TIERS[0];
  return 0;
}

export function recalculateStreakAchievement(input: {
  currentStreak: number;
  longestStreak: number;
  savedValue: number;
  savedTier: number;
}): { value: number; tier: number } {
  const value = Math.max(
    0,
    input.currentStreak,
    input.longestStreak,
    input.savedValue,
    legacyStreakValue(input.savedTier),
  );
  return { value, tier: streakTierForValue(value) };
}
