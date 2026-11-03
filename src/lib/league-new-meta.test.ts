import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_TIER_XP,
  LEAGUE_PROMOTION_CUTOFFS,
  LEAGUE_REWARDS,
  NEW_TIER_META,
  NEW_TIER_ORDER,
  nextLeagueTier,
  resolveNewTier,
  tierAfterWeeklyRank,
} from "./league-new-meta";

test("league hierarchy progresses through Emerald and Obsidian to Legends", () => {
  assert.deepEqual(NEW_TIER_ORDER, [
    "BRONZE",
    "SILVER",
    "GOLD",
    "EMERALD",
    "DIAMOND",
    "OBSIDIAN",
    "LEGENDS",
  ]);
  assert.equal(nextLeagueTier("GOLD"), "EMERALD");
  assert.equal(nextLeagueTier("EMERALD"), "DIAMOND");
  assert.equal(nextLeagueTier("DIAMOND"), "OBSIDIAN");
  assert.equal(nextLeagueTier("OBSIDIAN"), "LEGENDS");
  assert.equal(nextLeagueTier("LEGENDS"), null);
});

test("weekly promotion and relegation follow the full league hierarchy", () => {
  assert.equal(tierAfterWeeklyRank("GOLD", 1, 20), "EMERALD");
  assert.equal(tierAfterWeeklyRank("EMERALD", 1, 20), "DIAMOND");
  assert.equal(tierAfterWeeklyRank("DIAMOND", 1, 20), "OBSIDIAN");
  assert.equal(tierAfterWeeklyRank("OBSIDIAN", 1, 20), "LEGENDS");
  assert.equal(tierAfterWeeklyRank("LEGENDS", 20, 20), "OBSIDIAN");
  assert.equal(tierAfterWeeklyRank("OBSIDIAN", 20, 20), "DIAMOND");
  assert.equal(tierAfterWeeklyRank("DIAMOND", 20, 20), "EMERALD");
  assert.equal(tierAfterWeeklyRank("EMERALD", 20, 20), "GOLD");
  assert.equal(tierAfterWeeklyRank("BRONZE", 20, 20), "BRONZE");
  assert.equal(tierAfterWeeklyRank("GOLD", 1, 2), "EMERALD");
});

test("each league has its own identity and increasing podium rewards", () => {
  assert.equal(NEW_TIER_META.EMERALD.color, "#22C55E");
  assert.equal(NEW_TIER_META.OBSIDIAN.color, "#A855F7");
  assert.notEqual(NEW_TIER_META.EMERALD.iconPath, NEW_TIER_META.DIAMOND.iconPath);
  assert.notEqual(NEW_TIER_META.OBSIDIAN.iconPath, NEW_TIER_META.DIAMOND.iconPath);

  const rewards = NEW_TIER_ORDER.map((tier) => LEAGUE_REWARDS[tier][0]);
  assert.deepEqual(rewards, [...rewards].sort((a, b) => a - b));
  assert.equal(LEAGUE_REWARDS.LEGENDS[0], Math.max(...rewards));
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.OBSIDIAN, 5);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.LEGENDS, 0);
});

test("initial placement thresholds are defined for every non-Legends league", () => {
  for (const tier of NEW_TIER_ORDER.slice(0, -1)) {
    assert.notEqual(INITIAL_TIER_XP[tier], undefined);
  }
  assert.equal(INITIAL_TIER_XP.LEGENDS, undefined);
});

test("legacy persisted league names resolve to their canonical badge tiers", () => {
  assert.equal(resolveNewTier("PRATA"), "SILVER");
  assert.equal(resolveNewTier("OURO"), "GOLD");
  assert.equal(resolveNewTier("DIAMANTE"), "DIAMOND");
  assert.equal(resolveNewTier("LENDAS"), "LEGENDS");
});
