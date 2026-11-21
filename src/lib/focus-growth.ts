/**
 * Pure stage math for the timer's growth stages (a Forest-style tree):
 * begin → mid → full, plus die on give-up.
 *
 * The stage is a function of the session's elapsed time, always measured
 * against the session's server-stamped start (survives reloads, tab switches
 * and timer throttling) — never a client-side counter.
 */

export type TimerGrowthStage = "begin" | "mid" | "full";

/** begin: [0%, STAGE_MID_THRESHOLD); mid: [33%, completed). */
export const STAGE_MID_THRESHOLD = 0.33;

export function getGrowthStage(elapsedMs: number, totalMs: number): TimerGrowthStage {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return "begin";
  const elapsed = Math.max(0, elapsedMs);
  // "full" only when the session is COMPLETED: elapsed reaches the target.
  if (elapsed >= totalMs) return "full";
  return elapsed / totalMs >= STAGE_MID_THRESHOLD ? "mid" : "begin";
}
