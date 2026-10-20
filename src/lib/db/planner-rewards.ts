import type { PoolClient } from "pg";
import { PLANNER_TASK_REWARD } from "../daily-limits";
import { recordMissionProgress } from "./daily-quests";
import { addCoins } from "./settings";
import { addLeagueXP } from "./league-new";
import { creditXP } from "./xp";

export interface PlannerRewardDependencies {
  creditXP: typeof creditXP;
  addCoins: typeof addCoins;
  recordMissionProgress: typeof recordMissionProgress;
}

const plannerRewardDependencies: PlannerRewardDependencies = {
  creditXP,
  addCoins,
  recordMissionProgress,
};

export interface PlannerRewardResult {
  xpAwarded: number;
  coinsAwarded: number;
  balance?: number;
}

export async function grantPlannerCompletionReward(
  profileId: string,
  source: "weekly_plan" | "weekly_plan_occurrence",
  sourceId: number | string,
  completed: boolean,
  client: PoolClient,
  questDate?: string,
  dependencies: PlannerRewardDependencies = plannerRewardDependencies,
): Promise<PlannerRewardResult> {
  if (!completed) return { xpAwarded: 0, coinsAwarded: 0 };

  const xpAwarded = await dependencies.creditXP(profileId, source, sourceId, PLANNER_TASK_REWARD.xp, {
    db: client,
    coinsAmount: PLANNER_TASK_REWARD.coins,
    questDate,
  });
  if (xpAwarded === 0) return { xpAwarded: 0, coinsAwarded: 0 };

  const settings = await dependencies.addCoins(profileId, PLANNER_TASK_REWARD.coins, client);
  await dependencies.recordMissionProgress(profileId, "WEEKLY_PLAN_COMPLETED", {
    incrementBy: 1,
    client,
  });

  return {
    xpAwarded,
    coinsAwarded: PLANNER_TASK_REWARD.coins,
    balance: settings.coins,
  };
}

export async function updatePlannerLeagueXP(profileId: string, xpAwarded: number): Promise<void> {
  if (xpAwarded > 0) await addLeagueXP(profileId, xpAwarded);
}
