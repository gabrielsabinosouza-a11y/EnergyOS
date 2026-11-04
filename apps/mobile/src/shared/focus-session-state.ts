export const GRACE_PERIOD_SECONDS = 15;
export const AWAY_LIMIT_SECONDS = 60;
export const CANCEL_LATENCY_TOLERANCE_SECONDS = 2;

export type FocusSessionPhase =
  | "idle"
  | "grace_period"
  | "focusing"
  | "paused"
  | "completed"
  | "gave_up";

export type FocusSessionEndReason = "completed" | "gave_up";

export function focusPhaseAt(startedAtMs: number, nowMs: number): FocusSessionPhase {
  return nowMs - startedAtMs < GRACE_PERIOD_SECONDS * 1000 ? "grace_period" : "focusing";
}

export function canCancelFocusSession(startedAtMs: number, nowMs: number): boolean {
  const elapsedMs = nowMs - startedAtMs;
  return elapsedMs >= 0 &&
    elapsedMs <= (GRACE_PERIOD_SECONDS + CANCEL_LATENCY_TOLERANCE_SECONDS) * 1000;
}

export function focusedSecondsAt(
  startedAtMs: number,
  nowMs: number,
  totalPausedSeconds = 0,
  pausedAtMs?: number | null,
): number {
  const activePauseSeconds = pausedAtMs == null
    ? 0
    : Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
  return Math.max(
    0,
    Math.floor((nowMs - startedAtMs) / 1000) - totalPausedSeconds - activePauseSeconds,
  );
}

export function shouldGiveUpAfterAway(awaySeconds: number): boolean {
  return awaySeconds >= AWAY_LIMIT_SECONDS;
}

export function canPauseFocusSession(phase: FocusSessionPhase): boolean {
  return phase === "focusing";
}

export function transitionFocusSession(
  phase: FocusSessionPhase,
  event: "start" | "cancel" | "pause" | "resume" | "complete" | "give_up",
  elapsedSeconds = 0,
  targetDurationSeconds = 0,
): FocusSessionPhase | null {
  if (event === "start" && phase === "idle") return "grace_period";
  if (event === "cancel" && phase === "grace_period" &&
      elapsedSeconds <= GRACE_PERIOD_SECONDS + CANCEL_LATENCY_TOLERANCE_SECONDS) return "idle";
  if (event === "pause" && phase === "focusing") return "paused";
  if (event === "resume" && phase === "paused") return "focusing";
  if (event === "give_up" && (phase === "focusing" || phase === "paused")) return "gave_up";
  if (event === "complete" && phase === "focusing" &&
      elapsedSeconds >= targetDurationSeconds) return "completed";
  return null;
}

export function focusSessionEffects(
  outcome: "cancelled" | FocusSessionEndReason,
): {
  persistSession: boolean;
  countFocusedTime: boolean;
  awardRewards: boolean;
  advanceProgress: boolean;
} {
  if (outcome === "cancelled") {
    return {
      persistSession: false,
      countFocusedTime: false,
      awardRewards: false,
      advanceProgress: false,
    };
  }
  return {
    persistSession: true,
    countFocusedTime: true,
    awardRewards: outcome === "completed",
    advanceProgress: outcome === "completed",
  };
}
