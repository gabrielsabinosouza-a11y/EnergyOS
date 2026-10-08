import type { HabitFrequencyType } from "@/types";

/**
 * A weekly target without chosen weekdays is distributed evenly, starting on
 * Monday. This gives flexible schedules predictable due days and streaks.
 */
export function scheduledWeekdays(target: number): number[] {
  const count = Math.max(1, Math.min(7, Math.round(target || 1)));
  return Array.from({ length: count }, (_, index) => (Math.floor(index * 7 / count) + 1) % 7);
}

export function isHabitScheduledOnDate(
  frequencyType: HabitFrequencyType,
  frequencyDays: number[] | null,
  frequencyTarget: number | null,
  date: string,
): boolean {
  if (frequencyType === "daily") return true;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (frequencyType === "weekdays") return Boolean(frequencyDays?.includes(weekday));
  return scheduledWeekdays(frequencyTarget ?? 3).includes(weekday);
}
