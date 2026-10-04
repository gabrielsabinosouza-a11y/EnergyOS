export const APP_TIMEZONE = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso oficial do produto. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

/** Dia (YYYY-MM-DD) de um instante arbitrário no fuso oficial do produto. */
export function dayInTz(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    typeof date === "string" ? new Date(date) : date,
  );
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

// ─────────────────────────────────────────────────────────────────────────────
// Chaves e janelas de período (fuso oficial America/Sao_Paulo)
//
// Regra do produto: NUNCA usar `new Date().toISOString().slice(0,10)` para
// "hoje". Fora do fuso de São Paulo (UTC−3) isso devolve o dia errado entre
// 21:00 e 23:59 — exatamente a janela em que metas diárias são concluídas.
// ─────────────────────────────────────────────────────────────────────────────

/** Chave de data local (YYYY-MM-DD) de um instante, no fuso oficial do produto. */
export function getLocalDateKey(date: Date | string = new Date()): string {
  return dayInTz(date);
}

export interface DateRange {
  start: string;
  end: string;
}

/** Semana (segunda → domingo) que contém a data informada. */
export function getWeekRange(isoDate: string): DateRange {
  const start = weekStartIso(isoDate);
  return { start, end: addDaysIso(start, 6) };
}

/** Mês (primeiro → último dia) que contém a data informada. */
export function getMonthRange(isoDate: string): DateRange {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7)); // 1-12
  const start = `${isoDate.slice(0, 7)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: addDaysIso(start, daysInMonth - 1) };
}

/** Ano inteiro (01/01 → 31/12) — usado pelo histórico de atividade. */
export function getYearRange(year: number): DateRange {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export type GoalPeriodFrequency = "daily" | "weekly" | "monthly" | "unique";

/**
 * Janela do período ATUAL de uma meta. `null` = sem reset (meta única:
 * todos os registros contam, para sempre).
 */
export function goalPeriodRange(frequency: GoalPeriodFrequency, isoDate: string): DateRange | null {
  switch (frequency) {
    case "daily":
      return { start: isoDate, end: isoDate };
    case "weekly":
      return getWeekRange(isoDate);
    case "monthly":
      return getMonthRange(isoDate);
    case "unique":
      return null;
  }
}

/**
 * Chave determinística do período de uma meta — usada como sufixo do
 * `source_id` no xp_ledger para que cada período premie exatamente uma vez
 * (o equivalente ao document id `goalId_date` citado no briefing).
 */
export function goalPeriodKey(frequency: GoalPeriodFrequency, isoDate: string): string {
  switch (frequency) {
    case "daily":
      return `d:${isoDate}`;
    case "weekly":
      return `w:${weekStartIso(isoDate)}`;
    case "monthly":
      return `m:${isoDate.slice(0, 7)}`;
    case "unique":
      return "u:once";
  }
}

