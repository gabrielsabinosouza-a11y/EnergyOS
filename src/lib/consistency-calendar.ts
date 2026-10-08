import { addDaysIso, weekStartIso } from "./db/dates";
import type { ActivityDay } from "./activity";

export type ConsistencyWeek = (ActivityDay | null)[];

/** Monday-first week columns spanning exactly the weeks that intersect a year. */
export function buildConsistencyWeeks(year: number, days: ActivityDay[], today: string): ConsistencyWeek[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const firstMonday = weekStartIso(`${year}-01-01`);
  const end = `${year}-12-31`;
  const weeks: ConsistencyWeek[] = [];
  for (let monday = firstMonday; monday <= end; monday = addDaysIso(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, weekday) => {
      const date = addDaysIso(monday, weekday);
      if (!date.startsWith(`${year}-`)) return null;
      return byDate.get(date) ?? { date, checkin: null, dailyTaskCompletions: 0, future: date > today };
    }));
  }
  return weeks;
}

/** Zero-based (week column, Monday-first weekday row) position for a date. */
export function consistencyDatePosition(date: string, year: number): { column: number; row: number } | null {
  if (!date.startsWith(`${year}-`)) return null;
  const firstMonday = weekStartIso(`${year}-01-01`);
  const monday = weekStartIso(date);
  const start = Date.UTC(Number(firstMonday.slice(0, 4)), Number(firstMonday.slice(5, 7)) - 1, Number(firstMonday.slice(8, 10)));
  const target = Date.UTC(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1, Number(monday.slice(8, 10)));
  const row = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return { column: Math.round((target - start) / 604800000), row };
}
