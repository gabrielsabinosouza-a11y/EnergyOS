export const APP_TIMEZONE = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso oficial do produto. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

/** Instante UTC do próximo reset diário (meia-noite em São Paulo). */
export function dailyResetAtIso(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(now);
  const tomorrow = addDaysIso(today, 1);
  return new Date(`${tomorrow}T00:00:00-03:00`).toISOString();
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

/** Domingo da semana da data informada (a liga reinicia no domingo). */
export function sundayWeekStartIso(isoDate: string): string {
  const date = toUtcNoon(isoDate);
  return addDaysIso(isoDate, -date.getUTCDay());
}

/** Próximo domingo após a data (se a data já for domingo, o seguinte). */
export function nextSundayIso(isoDate: string): string {
  const date = toUtcNoon(isoDate);
  const add = date.getUTCDay() === 0 ? 7 : 7 - date.getUTCDay();
  return addDaysIso(isoDate, add);
}

/** Instante UTC em que a liga da semana atual reinicia (domingo 00:00 em São Paulo). */
export function leagueResetAtIso(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(now);
  const nextSunday = sundayWeekStartIso(today) === today ? addDaysIso(today, 7) : nextSundayIso(today);
  // Midnight America/Sao_Paulo on nextSunday, expressed as UTC ISO.
  const asUtc = new Date(`${nextSunday}T00:00:00-03:00`);
  return asUtc.toISOString();
}
