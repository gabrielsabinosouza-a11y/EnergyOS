import {
  TOP1_GLOBAL_FIRST_UNLOCK_BONUS,
  getLeagueZone,
  type NewLeagueTier,
} from "@/lib/league-new-meta";

export interface LeagueWeeklyFinalResult {
  profileId: string;
  groupId: number;
  weekStart: string;
  tier: NewLeagueTier;
  rank: number;
  groupSize: number;
  weeklyXP: number;
  coinsAwarded: number;
  result: "promoted" | "demoted" | "stayed";
  resultingTier: NewLeagueTier;
}

export interface LeagueWeeklyResultWriter {
  recordResultIfAbsent(result: LeagueWeeklyFinalResult): Promise<boolean>;
  awardCoins(input: {
    profileId: string;
    amount: number;
    referenceKey: string;
    weekStart: string;
    tier: NewLeagueTier;
    rank: number;
    rewardKind: "podium" | "top1_global_unlock";
  }): Promise<void>;
  recordTop1GlobalFinish(profileId: string, weekStart: string): Promise<boolean>;
  addFirstUnlockBonusToResult(profileId: string, groupId: number, amount: number): Promise<void>;
}

/** Persists one final placement and its rewards inside the caller's transaction. */
export async function persistLeagueWeeklyResultOnce(
  writer: LeagueWeeklyResultWriter,
  result: LeagueWeeklyFinalResult,
): Promise<boolean> {
  if (!(await writer.recordResultIfAbsent(result))) return false;

  const zone = getLeagueZone(result.tier, result.rank, result.groupSize);
  if (
    result.weeklyXP > 0 &&
    (zone === "promotion" || zone === "reward") &&
    result.coinsAwarded > 0
  ) {
    await writer.awardCoins({
      profileId: result.profileId,
      amount: result.coinsAwarded,
      referenceKey: `league-podium:${result.groupId}:${result.profileId}`,
      weekStart: result.weekStart,
      tier: result.tier,
      rank: result.rank,
      rewardKind: "podium",
    });
  }

  if (
    result.rank === 1
  ) {
    const firstUnlock = await writer.recordTop1GlobalFinish(result.profileId, result.weekStart);
    if (firstUnlock) {
      await writer.awardCoins({
        profileId: result.profileId,
        amount: TOP1_GLOBAL_FIRST_UNLOCK_BONUS,
        referenceKey: `top1-global-bonus:${result.profileId}`,
        weekStart: result.weekStart,
        tier: "LEGENDS",
        rank: 1,
        rewardKind: "top1_global_unlock",
      });
      await writer.addFirstUnlockBonusToResult(
        result.profileId,
        result.groupId,
        TOP1_GLOBAL_FIRST_UNLOCK_BONUS,
      );
    }
  }

  return true;
}
