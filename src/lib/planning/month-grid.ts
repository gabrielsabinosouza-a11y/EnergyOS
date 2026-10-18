import { isoKey, parseIsoKey } from "./dates";

/** Returns a Monday-first calendar grid, including adjacent-month dates. */
export function buildMonthGrid(year: number, month: number): string[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index - mondayOffset + 1));
    return isoKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  });
}

export function isInCalendarMonth(date: string, year: number, month: number): boolean {
  const parts = parseIsoKey(date);
  return parts.year === year && parts.month === month;
}
