/** Normalize older or malformed habit targets to the legacy one-check target. */
export function normalizeDailyTarget(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : 1;
}

export function clampDailyProgress(count: number, target: number): number {
  const safeTarget = normalizeDailyTarget(target);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(safeTarget, Math.floor(count)));
}

export function isDailyTargetReached(count: number, target: number): boolean {
  const safeTarget = normalizeDailyTarget(target);
  return clampDailyProgress(count, safeTarget) >= safeTarget;
}

export function adjustDailyProgress(count: number, target: number, delta: -1 | 1): number {
  return clampDailyProgress(count + delta, target);
}
