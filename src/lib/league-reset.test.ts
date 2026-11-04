import test from "node:test";
import assert from "node:assert/strict";
import {
  persistLeagueWeeklyResultOnce,
  type LeagueWeeklyFinalResult,
  type LeagueWeeklyResultWriter,
} from "./league-reset";

class InMemoryLeagueResultWriter implements LeagueWeeklyResultWriter {
  results = new Set<string>();
  balances = new Map<string, number>();
  references = new Set<string>();
  top1Finishes = new Map<string, number>();
  unlocked = new Set<string>();
  resultAmounts = new Map<string, number>();

  async recordResultIfAbsent(result: LeagueWeeklyFinalResult): Promise<boolean> {
    const key = `${result.groupId}:${result.profileId}`;
    if (this.results.has(key)) return false;
    this.results.add(key);
    this.resultAmounts.set(key, result.coinsAwarded);
    return true;
  }

  async awardCoins(input: {
    profileId: string;
    amount: number;
    referenceKey: string;
  }): Promise<void> {
    if (this.references.has(input.referenceKey)) return;
    this.references.add(input.referenceKey);
    this.balances.set(
      input.profileId,
      (this.balances.get(input.profileId) ?? 0) + input.amount,
    );
  }

  async recordTop1GlobalFinish(profileId: string): Promise<boolean> {
    this.top1Finishes.set(profileId, (this.top1Finishes.get(profileId) ?? 0) + 1);
    if (this.unlocked.has(profileId)) return false;
    this.unlocked.add(profileId);
    return true;
  }

  async addFirstUnlockBonusToResult(
    profileId: string,
    groupId: number,
    amount: number,
  ): Promise<void> {
    const key = `${groupId}:${profileId}`;
    this.resultAmounts.set(key, (this.resultAmounts.get(key) ?? 0) + amount);
  }
}

test("replaying a weekly reset result cannot duplicate podium coins or the first-unlock bonus", async () => {
  const writer = new InMemoryLeagueResultWriter();
  const result: LeagueWeeklyFinalResult = {
    profileId: "user-1",
    groupId: 42,
    weekStart: "2026-10-25",
    tier: "LEGENDS",
    rank: 1,
    groupSize: 2,
    weeklyXP: 600,
    coinsAwarded: 600,
    result: "stayed",
    resultingTier: "LEGENDS",
  };

  assert.equal(await persistLeagueWeeklyResultOnce(writer, result), true);
  assert.equal(await persistLeagueWeeklyResultOnce(writer, result), false);
  assert.equal(await persistLeagueWeeklyResultOnce(writer, {
    ...result,
    groupId: 43,
    weekStart: "2026-11-01",
  }), true);
  assert.equal(writer.balances.get("user-1"), 2_200);
  assert.equal(writer.resultAmounts.get("42:user-1"), 1_600);
  assert.equal(writer.resultAmounts.get("43:user-1"), 600);
  assert.equal(writer.top1Finishes.get("user-1"), 2);
  assert.equal(writer.references.size, 3);
});

test("inactive or solo Legends leaders do not unlock Top 1 Global rewards", async () => {
  const writer = new InMemoryLeagueResultWriter();
  const solo: LeagueWeeklyFinalResult = {
    profileId: "solo",
    groupId: 1,
    weekStart: "2026-10-25",
    tier: "LEGENDS",
    rank: 1,
    groupSize: 1,
    weeklyXP: 100,
    coinsAwarded: 600,
    result: "stayed",
    resultingTier: "LEGENDS",
  };
  const inactive: LeagueWeeklyFinalResult = {
    ...solo,
    profileId: "inactive",
    groupId: 2,
    groupSize: 2,
    weeklyXP: 0,
    coinsAwarded: 0,
  };

  await persistLeagueWeeklyResultOnce(writer, solo);
  await persistLeagueWeeklyResultOnce(writer, inactive);
  assert.equal(writer.top1Finishes.size, 0);
  assert.equal(writer.balances.get("solo"), 600);
  assert.equal(writer.balances.has("inactive"), false);
});
