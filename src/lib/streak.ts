import { isToday, isYesterday, differenceInCalendarDays, parseISO } from "date-fns";

export interface StreakResult {
  /** Number of consecutive qualifying days including today (if qualified). */
  currentStreak: number;
  /** Whether at least one qualifying session was completed today. */
  todayQualified: boolean;
}

/**
 * Pure, side-effect-free streak calculator.
 *
 * Given a list of ISO date strings (YYYY-MM-DD) on which the user completed at
 * least one qualifying focus session, and the current "today" date string,
 * returns the current streak count and whether today is already qualified.
 *
 * All day comparisons use date-fns (`isToday`, `isYesterday`,
 * `differenceInCalendarDays`) so the calculations are immune to timezone drift.
 *
 * Rules:
 *  - A day counts if it appears in `completedDates` (i.e. the user completed at
 *    least one session that met the duration target).
 *  - Today counts toward the streak only if it appears in `completedDates`.
 *  - Today is never treated as a "gap" — if today is missing the streak is
 *    simply not yet extended to today, but yesterday's run is preserved.
 *  - The streak breaks at the first past day that has no qualifying session
 *    and is not protected by a shield (shield logic is handled upstream).
 *
 * @param completedDates  ISO date strings (YYYY-MM-DD) of days with at least
 *                        one qualifying session. Duplicates are ignored.
 * @param today           Current date as YYYY-MM-DD in the product timezone.
 */
export function calculateStreak(
  completedDates: string[],
  today: string,
): StreakResult {
  // Normalize to a date-key set (YYYY-MM-DD), dropping duplicates.
  const uniqueDates = [...new Set(completedDates)].sort().reverse();

  const todayQualified = uniqueDates.some((d) => d === today);

  // Walk backward from today, counting consecutive qualifying days.
  // Today is included only if qualified; it is never treated as a gap.
  let streak = 0;
  for (let i = 0; i < 400; i += 1) {
    const cursor = shiftIso(today, -i);
    const isTodayRow = i === 0;

    if (isTodayRow && !todayQualified) {
      // Today hasn't been qualified yet — skip it without breaking the run.
      // The streak continues from whatever happened yesterday.
      continue;
    }

    if (uniqueDates.includes(cursor)) {
      streak += 1;
    } else {
      // First past day with no qualifying session → the streak breaks here.
      break;
    }
  }

  return { currentStreak: streak, todayQualified };
}

/** True when `isoDate` (YYYY-MM-DD) is today per date-fns. */
export function isDateToday(isoDate: string): boolean {
  return isToday(parseIsoNoon(isoDate));
}

/** True when `isoDate` (YYYY-MM-DD) is yesterday per date-fns. */
export function isDateYesterday(isoDate: string): boolean {
  return isYesterday(parseIsoNoon(isoDate));
}

/** Whole calendar days from `earlier` to `later` (positive when later is later). */
export function calendarDaysBetween(later: string, earlier: string): number {
  return differenceInCalendarDays(parseIsoNoon(later), parseIsoNoon(earlier));
}

/** Parse a YYYY-MM-DD to a UTC date object (noon avoids DST edge cases). */
function parseIsoNoon(isoDate: string): Date {
  return parseISO(`${isoDate}T12:00:00`);
}

/** Shift a YYYY-MM-DD string by `days` (can be negative). */
function shiftIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
