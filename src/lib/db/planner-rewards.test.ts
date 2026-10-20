import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { PLANNER_TASK_REWARD } from "../daily-limits";
import {
  grantPlannerCompletionReward,
  type PlannerRewardDependencies,
} from "./planner-rewards";

function createRewardDependencies() {
  const claimed = new Set<string>();
  let balance = 0;
  let totalXp = 0;
  let missionProgress = 0;
  const dependencies: PlannerRewardDependencies = {
    creditXP: async (_profileId, source, sourceId, xp) => {
      const key = `${source}:${sourceId}`;
      if (claimed.has(key)) return 0;
      claimed.add(key);
      totalXp += xp;
      return xp;
    },
    addCoins: async (profileId, amount) => {
      balance += amount;
      return {
        profileId,
        notificationsEnabled: true,
        preferredTheme: "dark",
        coins: balance,
        soundNotificationsEnabled: true,
        onboardingCompleted: true,
        reminderCheckinEnabled: false,
        reminderFocusEnabled: false,
        reminderSleepEnabled: false,
      };
    },
    recordMissionProgress: async () => {
      missionProgress += 1;
    },
  };

  return {
    dependencies,
    totals: () => ({ balance, totalXp, missionProgress }),
  };
}

const client = {} as PoolClient;

test("first planner completion grants the configured XP and coins", async () => {
  const { dependencies, totals } = createRewardDependencies();
  const reward = await grantPlannerCompletionReward(
    "profile-1",
    "weekly_plan",
    12,
    true,
    client,
    undefined,
    dependencies,
  );

  assert.deepEqual(PLANNER_TASK_REWARD, { xp: 20, coins: 20 });
  assert.equal(reward.xpAwarded, 20);
  assert.equal(reward.coinsAwarded, 20);
  assert.equal(reward.balance, 20);
  assert.deepEqual(totals(), { balance: 20, totalXp: 20, missionProgress: 1 });
});

test("unchecking and rechecking a plan does not grant a second reward", async () => {
  const { dependencies, totals } = createRewardDependencies();
  await grantPlannerCompletionReward("profile-1", "weekly_plan", 12, true, client, undefined, dependencies);

  const unchecked = await grantPlannerCompletionReward("profile-1", "weekly_plan", 12, false, client, undefined, dependencies);
  const rechecked = await grantPlannerCompletionReward("profile-1", "weekly_plan", 12, true, client, undefined, dependencies);

  assert.deepEqual(unchecked, { xpAwarded: 0, coinsAwarded: 0 });
  assert.deepEqual(rechecked, { xpAwarded: 0, coinsAwarded: 0 });
  assert.deepEqual(totals(), { balance: 20, totalXp: 20, missionProgress: 1 });
});

test("concurrent completion requests grant the reward only once", async () => {
  const { dependencies, totals } = createRewardDependencies();
  const rewards = await Promise.all(
    Array.from({ length: 8 }, () =>
      grantPlannerCompletionReward("profile-1", "weekly_plan_occurrence", "5:2026-10-20", true, client, undefined, dependencies),
    ),
  );

  assert.equal(rewards.filter((reward) => reward.xpAwarded > 0).length, 1);
  assert.equal(rewards.filter((reward) => reward.coinsAwarded > 0).length, 1);
  assert.deepEqual(totals(), { balance: 20, totalXp: 20, missionProgress: 1 });
});

test("each recurring occurrence has an independent one-time reward", async () => {
  const { dependencies, totals } = createRewardDependencies();
  const monday20 = "8:2026-10-20";
  const monday27 = "8:2026-10-27";

  const first = await grantPlannerCompletionReward("profile-1", "weekly_plan_occurrence", monday20, true, client, undefined, dependencies);
  const second = await grantPlannerCompletionReward("profile-1", "weekly_plan_occurrence", monday27, true, client, undefined, dependencies);
  const repeated = await grantPlannerCompletionReward("profile-1", "weekly_plan_occurrence", monday20, true, client, undefined, dependencies);

  assert.equal(first.xpAwarded, 20);
  assert.equal(second.xpAwarded, 20);
  assert.deepEqual(repeated, { xpAwarded: 0, coinsAwarded: 0 });
  assert.deepEqual(totals(), { balance: 40, totalXp: 40, missionProgress: 2 });
});
