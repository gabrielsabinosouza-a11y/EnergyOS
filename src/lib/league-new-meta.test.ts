import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_TIER_XP,
  LEAGUE_PROMOTION_CUTOFFS,
  LEAGUE_REWARDS,
  NEW_TIER_META,
  NEW_TIER_ORDER,
  DEMOTION_START_RANK,
  PROMOTION_TOP,
  getLeagueZone,
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
  assert.equal(tierAfterWeeklyRank("SILVER", 1, 2, 0), "SILVER");
});

test("each league has its own identity and increasing podium rewards", () => {
  assert.equal(NEW_TIER_META.EMERALD.color, "#22C55E");
  assert.equal(NEW_TIER_META.OBSIDIAN.color, "#A855F7");
  assert.notEqual(NEW_TIER_META.EMERALD.iconPath, NEW_TIER_META.DIAMOND.iconPath);
  assert.notEqual(NEW_TIER_META.OBSIDIAN.iconPath, NEW_TIER_META.DIAMOND.iconPath);

  const rewards = NEW_TIER_ORDER.map((tier) => LEAGUE_REWARDS[tier][0]);
  assert.deepEqual(rewards, [...rewards].sort((a, b) => a - b));
  assert.equal(LEAGUE_REWARDS.LEGENDS[0], Math.max(...rewards));
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.OBSIDIAN, 0);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.LEGENDS, 0);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.BRONZE, 10);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.SILVER, 7);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.GOLD, 5);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.EMERALD, 5);
  assert.equal(LEAGUE_PROMOTION_CUTOFFS.DIAMOND, 5);
});

test("league zones use per-tier promotion and reward boundaries", () => {
  // Test promotion zones for each tier
  // Bronze: Top 10
  assert.equal(getLeagueZone("BRONZE", 1, 20), "promotion");
  assert.equal(getLeagueZone("BRONZE", 10, 20), "promotion");
  assert.equal(getLeagueZone("BRONZE", 11, 20), "safe");
  
  // Silver: Top 7
  assert.equal(getLeagueZone("SILVER", 1, 20), "promotion");
  assert.equal(getLeagueZone("SILVER", 7, 20), "promotion");
  assert.equal(getLeagueZone("SILVER", 8, 20), "safe");
  
  // Gold, Emerald, Diamond: Top 5
  for (const tier of ["GOLD", "EMERALD", "DIAMOND"] as NewLeagueTier[]) {
    assert.equal(getLeagueZone(tier, 1, 20), "promotion");
    assert.equal(getLeagueZone(tier, 5, 20), "promotion");
    assert.equal(getLeagueZone(tier, 6, 20), "safe");
  }
  
  // Obsidian and Legends: Top 3 (reward zone, not promotion)
  for (const tier of ["OBSIDIAN", "LEGENDS"] as NewLeagueTier[]) {
    assert.equal(getLeagueZone(tier, 1, 20), "reward");
    assert.equal(getLeagueZone(tier, 3, 20), "reward");
    assert.equal(getLeagueZone(tier, 4, 20), "safe");
  }
  
  // Test demotion zones (same for all non-Bronze tiers)
  const groupSize = 30;
  for (const tier of NEW_TIER_ORDER.slice(1)) { // Skip BRONZE
    assert.equal(
      getLeagueZone(tier, DEMOTION_START_RANK, groupSize),
      "demotion",
      `${tier} demotion boundary`,
    );
  }
  assert.equal(getLeagueZone("BRONZE", DEMOTION_START_RANK, groupSize), "safe");
  
  // Edge case: group smaller than cutoff
  assert.equal(getLeagueZone("BRONZE", 5, 5), "promotion"); // All 5 are in top 10
  assert.equal(getLeagueZone("SILVER", 5, 5), "promotion"); // All 5 are in top 7
  assert.equal(getLeagueZone("OBSIDIAN", 3, 3), "reward"); // All 3 are in top 3
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
