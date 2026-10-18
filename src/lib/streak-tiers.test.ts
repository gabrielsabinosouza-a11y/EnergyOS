import test from "node:test";
import assert from "node:assert/strict";
import { legacyStreakValue, recalculateStreakAchievement, STREAK_TIERS } from "./streak-tiers";

test("Mestre da Sequência uses the shared four thresholds", () => {
  assert.deepEqual(STREAK_TIERS, [7, 14, 30, 100]);
});

test("recalculation unlocks 14 days while retaining the user's previously saved best", () => {
  assert.deepEqual(
    recalculateStreakAchievement({
      currentStreak: 15,
      longestStreak: 15,
      savedValue: 7,
      savedTier: 1,
    }),
    { value: 15, tier: 2 },
  );
});

test("legacy tier indexes preserve previously reached milestones without the old top threshold", () => {
  assert.equal(legacyStreakValue(1), 7);
  assert.equal(legacyStreakValue(2), 30);
  assert.equal(legacyStreakValue(3), 100);
  assert.equal(legacyStreakValue(4), 100);
  assert.deepEqual(
    recalculateStreakAchievement({ currentStreak: 0, longestStreak: 0, savedValue: 0, savedTier: 4 }),
    { value: 100, tier: 4 },
  );
});
