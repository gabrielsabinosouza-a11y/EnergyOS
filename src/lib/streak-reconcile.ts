/**
 * Single source of truth for streak + shield reconciliation.
 *
 * A day counts for the streak ONLY when the user completed at least one focus
 * session that day (any duration, even 1 minute) — or when a shield protected
 * that day. Check-ins, goals, tasks and missions do NOT count.
 *
 * Pure and side-effect free: the caller (db/tasks.computeStreak) feeds the
 * real focus-day list and persists the result inside one transaction.
 */

/** How to react when the missed-day region is wider than the shield budget. */
export const SHIELD_POLICY = {
  /** "reset": streak goes to 0 and NO shield is consumed. */
  onShortage: "reset" as "reset" | "bridgeWhatFits",
};

export interface ReconcileStreakInput {
  /** Days (YYYY-MM-DD, local product timezone) with ≥1 completed focus session. */
  focusDays: string[];
  /** Days (YYYY-MM-DD) previously protected by a shield. */
  protectedDays: string[];
  /** Shields currently available. */
  shields: number;
  /** Today as YYYY-MM-DD (America/Sao_Paulo). Never treated as missed. */
  today: string;
}

export interface ReconcileStreakResult {
  currentStreak: number;
  bestStreak: number;
  /** Shields left after auto-consuming one per newly bridged missed day. */
  shields: number;
  /** Days that needed a shield to stay alive (excluding already-protected ones). */
  newProtectedDays: string[];
  /** Days that broke the streak (the recent dead region before the reset). */
  lostDays: string[];
  status: "qualified" | "alive" | "protected" | "broken" | "empty";
}

const MAX_WINDOW_DAYS = 400;

export function reconcileStreak({
  focusDays,
  protectedDays,
  shields,
  today,
}: ReconcileStreakInput): ReconcileStreakResult {
  const focusSet = new Set(focusDays);
  const protectedSet = new Set(protectedDays);
  const newProtectedDays: string[] = [];
  let remainingShields = shields;

  const isAlive = (day: string) => focusSet.has(day) || protectedSet.has(day);

  // Identify the most recent alive day (focus or protected), scanning back
  // from today. Today itself may be pending — that's not a gap.
  let lastAlive: string | null = null;
  for (let i = 0; i <= MAX_WINDOW_DAYS; i += 1) {
    const day = shiftIso(today, -i);
    if (isAlive(day)) {
      lastAlive = day;
      break;
    }
  }

  // Missed days strictly after the last alive day and before today.
  const missedRegion: string[] = [];
  if (lastAlive !== null) {
    let cursor = shiftIso(lastAlive, 1);
    while (cursor < today) {
      if (!isAlive(cursor)) missedRegion.push(cursor);
      cursor = shiftIso(cursor, 1);
    }
  }

  let lostDays: string[] = [];

  if (missedRegion.length === 0) {
    // No gap — nothing to bridge.
  } else if (lastAlive === null || (hasAnyStreak(focusSet, protectedSet, today, MAX_WINDOW_DAYS) === false)) {
    // No live streak to protect — never spend shields.
    lostDays = missedRegion;
  } else if (remainingShields >= missedRegion.length) {
    for (const day of missedRegion) {
      protectedSet.add(day);
      newProtectedDays.push(day);
    }
    remainingShields -= missedRegion.length;
  } else if (SHIELD_POLICY.onShortage === "bridgeWhatFits") {
    for (let i = 0; i < remainingShields; i += 1) {
      const day = missedRegion[missedRegion.length - 1 - i];
      protectedSet.add(day);
      newProtectedDays.push(day);
    }
    lostDays = missedRegion.slice(0, missedRegion.length - remainingShields);
    remainingShields = 0;
  } else {
    // Shortage → streak broken, no shield consumed.
    lostDays = missedRegion;
  }

  // Count the current streak: walk back from today; focus days add +1,
  // protected days keep the run alive but do NOT add to the count.
  let currentStreak = 0;
  for (let i = 0; i <= MAX_WINDOW_DAYS; i += 1) {
    const day = shiftIso(today, -i);
    if (i === 0 && !isAlive(day)) continue; // today still open
    if (focusSet.has(day)) {
      currentStreak += 1;
    } else if (protectedSet.has(day)) {
      // alive but +0
    } else {
      break;
    }
  }

  // Best streak: longest run where consecutive days are alive (focus or
  // protected); only focus days increment.
  const bestStreak = computeBest(focusSet, protectedSet);

  const status: ReconcileStreakResult["status"] =
    currentStreak === 0 && newProtectedDays.length === 0
      ? lostDays.length > 0
        ? "broken"
        : "empty"
      : newProtectedDays.length > 0
        ? "protected"
        : focusSet.has(today)
          ? "qualified"
          : "alive";

  return {
    currentStreak,
    bestStreak,
    shields: remainingShields,
    newProtectedDays,
    lostDays,
    status,
  };
}

function computeBest(focusSet: Set<string>, protectedSet: Set<string>): number {
  const alive = [...new Set([...focusSet, ...protectedSet])].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of alive) {
    const consecutive = prev !== null && shiftIso(prev, 1) === day;
    if (consecutive) {
      if (focusSet.has(day)) run += 1;
    } else {
      run = focusSet.has(day) ? 1 : 0;
    }
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

function hasAnyStreak(focusSet: Set<string>, protectedSet: Set<string>, today: string, windowDays: number): boolean {
  const floor = shiftIso(today, -windowDays);
  for (const day of focusSet) if (day >= floor && day <= today) return true;
  for (const day of protectedSet) if (day >= floor && day <= today) return true;
  return false;
}

function shiftIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
