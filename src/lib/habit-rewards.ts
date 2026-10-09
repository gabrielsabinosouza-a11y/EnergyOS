/**
 * HABIT REWARD RULE — THE SINGLE SOURCE OF TRUTH FOR WHAT A HABIT CHECK-IN
 * IS WORTH AND WHEN.
 *
 * Both the server grant path (`src/lib/db/daily-tasks.ts`) and the client copy
 * (`recurring-daily-tasks.tsx` / `daily-tasks-widget.tsx`) import from here, so
 * the reward logic and the words shown to the user can never drift apart.
 *
 * This file is intentionally framework-free and free of `pg`/`pool` imports, so
 * it is safe to import from Client Components AND from the Node test runner.
 *
 * Rule (pt-BR product spec):
 *   - Completing a habit (reaching its daily target) earns +10 XP and +10 coins.
 *   - Only the first `DAILY_REWARDED_HABITS_CAP` (=10) completions each day earn
 *     the per-habit reward; the 11th still completes the habit but grants 0.
 *   - Once per day, when EVERY habit scheduled for today is completed, an extra
 *     `ALL_DONE_BONUS_COINS` (=10) bonus is granted.
 *   - Day boundaries use America/São Paulo (see `src/lib/db/dates.ts`); a check
 *     at 23:30 local lands on the right day.
 *   - Habits with a daily target > 1 (e.g. 3x/day) reward only when the target is
 *     reached, once per day — not on every increment.
 *   - Un-checking never refunds (kept consistent with the current behavior); a
 *     re-check therefore grants nothing again, so check/uncheck loops cannot
 *     farm coins. The granted amounts are stored on the check-in row so a future
 *     refund path would always refund exactly what was awarded.
 */

import { clampDailyProgress, normalizeDailyTarget } from "./daily-habit-progress";
import {
  HABIT_REWARD,
  DAILY_REWARDED_HABITS_CAP,
  ALL_DONE_BONUS_COINS,
  HABIT_COMPLETION_SOURCE,
} from "./daily-limits";

export { HABIT_REWARD, DAILY_REWARDED_HABITS_CAP, ALL_DONE_BONUS_COINS, HABIT_COMPLETION_SOURCE };

/** The per-habit completion reward, as a single object `{ xp, coins }`. */
export type HabitReward = typeof HABIT_REWARD;

/**
 * The decision the server makes for a single completion attempt. `coins` is the
 * per-habit coins only; `bonusCoins` is the all-done bonus (tracked separately
 * so the client can animate them independently). `capReached` lets the UI show
 * the "Limite diário de recompensas atingido" note.
 */
export interface HabitRewardDecision {
  xp: number;
  coins: number;
  bonusCoins: number;
  capReached: boolean;
}

export interface HabitRewardContext {
  /** True only when the habit just crossed its daily target for the first time today (not already rewarded). */
  completionTriggered: boolean;
  /** How many habits have already been rewarded today (drives the daily cap). */
  rewardedToday: number;
  /** True when every habit scheduled for today is completed (all-done bonus condition). */
  allCompletedToday: boolean;
}

/**
 * Pure decision: given the day's context, how much should THIS completion grant
 * right now? No DB access, no auth, deterministic — safe to unit test and to run
 * optimistically on the client for a preview.
 */
export function decideHabitReward(ctx: HabitRewardContext): HabitRewardDecision {
  // Not a first-time completion today → nothing new to grant.
  if (!ctx.completionTriggered) {
    return { xp: 0, coins: 0, bonusCoins: 0, capReached: false };
  }

  const capReached = ctx.rewardedToday >= DAILY_REWARDED_HABITS_CAP;

  // The all-done bonus is independent of the per-habit cap: it is granted once
  // per day via a PK-gated insert on `daily_habit_bonus_log`, so it can still
  // fire even when the 11th habit completes all-done.
  const bonusCoins = ctx.allCompletedToday ? ALL_DONE_BONUS_COINS : 0;

  if (capReached) {
    // Habit is completed but the daily reward budget is exhausted: no per-habit
    // reward, yet the all-done bonus can still be granted.
    return { xp: 0, coins: 0, bonusCoins, capReached: true };
  }

  return {
    xp: HABIT_REWARD.xp,
    coins: HABIT_REWARD.coins,
    bonusCoins,
    capReached: false,
  };
}

export interface HabitCompletionState {
  /** Whether the habit is now complete for the day (count >= target). */
  isCompleted: boolean;
  /** Whether crossing into complete-state just now triggers a (possible) reward. */
  completionTriggered: boolean;
}

/**
 * Pure transition: from a previous counts/claim state to a new count, decide
 * whether target was just reached for the first time today. Captures the
 * target>1 rule (only the Nth increment that reaches the target fires) and the
 * un-check / re-check rule (re-check never re-triggers once rewarded).
 *
 * @param previousCount  completion_count before this action (clamped to target)
 * @param newCount       completion_count after this action (clamped to target)
 * @param dailyTarget    the habit's daily target (>=1)
 * @param alreadyRewarded whether rewards_claimed is already true for (habit, date)
 */
export function computeCompletionState(
  previousCount: number,
  newCount: number,
  dailyTarget: number,
  alreadyRewarded: boolean,
): HabitCompletionState {
  const target = normalizeDailyTarget(dailyTarget);
  const prev = clampDailyProgress(previousCount, target);
  const next = clampDailyProgress(newCount, target);
  const wasCompleted = prev >= target;
  const isCompleted = next >= target;
  const completionTriggered = !wasCompleted && isCompleted && !alreadyRewarded;
  return { isCompleted, completionTriggered };
}

/**
 * The helper text shown above the Hábitos list on Visão geral, built entirely
 * from the config constants so the copy can never contradict the rewarded
 * values. Used by both the recurring-daily-tasks and daily-tasks-widget panels.
 *
 * Exact required copy:
 *   "Cada hábito concluído rende +10 XP e +10 moedas (até 10 por dia) — e +10
 *    moedas de bônus ao completar todos."
 */
export function habitRewardHelperText(): string {
  const parts: string[] = [];
  parts.push(
    `Cada hábito concluído rende +${HABIT_REWARD.xp} XP e +${HABIT_REWARD.coins} moedas` +
      ` (até ${DAILY_REWARDED_HABITS_CAP} por dia)`,
  );
  if (ALL_DONE_BONUS_COINS > 0) {
    parts.push(`e +${ALL_DONE_BONUS_COINS} moedas de bônus ao completar todos`);
  }
  // Join with the em dash + "e" cadence required by the spec.
  return parts.join(" — ");
}
