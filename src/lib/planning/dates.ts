/**
 * Data do produto: modelo de calendário LOCAL (America/Sao_Paulo).
 *
 * Regra: TODAS as chaves de data são strings "YYYY-MM-DD" construídas a partir
 * das partes locais (ano, mês, dia). NUNCA usar `new Date("YYYY-MM-DD")` nem
 * `toISOString().slice(0,10)` para dados de calendário: strings "YYYY-MM-DD"
 * parseadas como UTC meiam-noite viram o dia anterior no fuso UTC-3 (ex.: em
 * São Paulo, 15/10 às 00:00 UTC = 14/10 às 21:00 local → toLocaleDateString
 * devolve 14/10).
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

/** Hoje (YYYY-MM-DD) no fuso oficial do produto. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

/** Chave de data local (YYYY-MM-DD) de um instante, no fuso oficial do produto. */
export function dayInTz(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

/** Constrói uma chave YYYY-MM-DD a partir de partes locais (sem tocar UTC). */
export function isoKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Separa uma chave YYYY-MM-DD em partes locais de ano/mês/dia. */
export function parseIsoKey(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

/** Soma n dias de calendário a uma chave YYYY-MM-DD (aritmética local de calendário). */
export function addDays(iso: string, n: number): string {
  const { year, month, day } = parseIsoKey(iso);
  const d = new Date(year, month - 1, day + n);
  return isoKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Segunda-feira da semana que contém a data informada. */
export function weekStart(iso: string): string {
  const { year, month, day } = parseIsoKey(iso);
  const d = new Date(year, month - 1, day);
  const mondayOffset = (d.getDay() + 6) % 7; // segunda=0 … domingo=6
  return addDays(iso, -mondayOffset);
}

/** Intervalo segunda → domingo da semana que contém a data. */
export function weekRange(iso: string): { start: string; end: string } {
  const start = weekStart(iso);
  return { start, end: addDays(start, 6) };
}

/** Primeiro e último dia do mês que contém a data. */
export function monthRange(iso: string): { start: string; end: string } {
  const { year, month } = parseIsoKey(iso);
  const start = isoKey(year, month, 1);
  const daysInMonth = new Date(year, month, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  return { start, end: isoKey(year, month, daysInMonth) };
}

/** Quantidade de dias do mês que contém a data. */
export function daysInMonth(iso: string): number {
  const { year, month } = parseIsoKey(iso);
  return new Date(year, month, 0).getDate();
}

/** Adiciona N meses (calendário local) a uma chave YYYY-MM-DD. */
export function addMonths(iso: string, n: number): string {
  const { year, month, day } = parseIsoKey(iso);
  const d = new Date(year, month - 1 + n, day);
  return isoKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Nome curto do dia da semana em pt-BR (segunda = índice 0). */
export const SHORT_WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Formata um rótulo de cabeçalho pt-BR de acordo com a vista. */
export function viewLabel(iso: string, view: "month" | "week" | "day"): string {
  const { year, month, day } = parseIsoKey(iso);
  const date = new Date(year, month - 1, day);
  if (view === "month") {
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); // "outubro de 2026"
  }
  if (view === "week") {
    const { start, end } = weekRange(iso);
    const [, , sd] = start.split("-");
    const [, , ed] = end.split("-");
    return `${Number(sd)} - ${Number(ed)} de ${date.toLocaleDateString("pt-BR", { month: "long" })}`; // "12 - 18 de outubro"
  }
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); // "quinta-feira, 15 de outubro"
}
