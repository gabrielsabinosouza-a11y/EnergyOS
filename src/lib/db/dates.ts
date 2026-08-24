export const APP_TIMEZONE = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso oficial do produto. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

function toUtcNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = toUtcNoon(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Segunda-feira da semana da data informada. */
export function weekStartIso(isoDate: string): string {
  const date = toUtcNoon(isoDate);
  const weekdayMondayFirst = (date.getUTCDay() + 6) % 7;
  return addDaysIso(isoDate, -weekdayMondayFirst);
}

export function diffDaysIso(later: string, earlier: string): number {
  const ms = toUtcNoon(later).getTime() - toUtcNoon(earlier).getTime();
  return Math.round(ms / 86_400_000);
}
