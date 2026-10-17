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

/** Uma semana do calendário dentro de um mês específico. */
export interface MonthWeek {
  /** 1-based: Semana 1 = dias 1–7, Semana 2 = 8–14, Semana 3 = 15–21, Semana 4 = 22–último. */
  index: number;
  /** Primeiro dia da semana dentro do mês (YYYY-MM-DD). */
  start: string;
  /** Último dia da semana dentro do mês (YYYY-MM-DD). */
  end: string;
  /** Dias do mês desta semana, em ordem crescente. */
  days: string[];
}

/**
 * Agrupa o mês em NO MÁXIMO 4 semanas (regra do produto):
 *
 * - Semana 1 = dia 1 até o dia 7
 * - Semana 2 = dia 8 até o dia 14
 * - Semana 3 = dia 15 até o dia 21
 * - Semana 4 = dia 22 até o último dia do mês (absorve dias 29, 30 e 31)
 *
 * Assim os dias de "borda" do mês (início e fim) são mergeados nas semanas 1 e 4
 * e um mês nunca gera uma 5ª ou 6ª semana. Dias de meses vizinhos NÃO entram.
 */
export function getMonthWeeks(year: number, month: number): MonthWeek[] {
  const total = new Date(year, month, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  // [primeiro dia, último dia] de cada semana — a última semana absorve o fim do mês.
  const ranges: Array<[number, number]> = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, total],
  ];
  const weeks: MonthWeek[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const [from, to] = ranges[i];
    const start = Math.max(from, 1);
    const end = Math.min(to, total);
    const days: string[] = [];
    for (let d = start; d <= end; d++) days.push(isoKey(year, month, d));
    weeks.push({ index: i + 1, start: days[0], end: days[days.length - 1], days });
  }
  return weeks;
}

/** Agrupa as semanas do mês que contém a data informada (YYYY-MM-DD). */
export function getMonthWeeksFor(iso: string): MonthWeek[] {
  const { year, month } = parseIsoKey(iso);
  return getMonthWeeks(year, month);
}

/** Adiciona N meses (calendário local) a uma chave YYYY-MM-DD. */
export function addMonths(iso: string, n: number): string {
  const { year, month, day } = parseIsoKey(iso);
  const d = new Date(year, month - 1 + n, day);
  return isoKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Nome curto do dia da semana em pt-BR (segunda = índice 0). */
export const SHORT_WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Formata uma data local (YYYY-MM-DD) em pt-BR sem risco de deslocamento UTC.
 *  Usa meio-dia local para nunca cruzar o limite do dia em fusos negativo. */
export function formatLocalDate(iso: string, options: Intl.DateTimeFormatOptions = {}): string {
  const { year, month, day } = parseIsoKey(iso);
  return new Date(year, month - 1, day, 12).toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, ...options });
}

/** Formata um rótulo de cabeçalho pt-BR de acordo com a vista. */
export function viewLabel(iso: string, view: "month" | "week" | "day"): string {
  const { year, month, day } = parseIsoKey(iso);
  const date = new Date(year, month - 1, day);
  if (view === "month") {
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); // "outubro de 2026"
  }
  if (view === "week") {
    // Na vista Semana o rótulo é o mês/ano inteiro do plano (ex.: "outubro de 2026").
    return formatLocalDate(iso, { month: "long", year: "numeric" });
  }
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); // "quinta-feira, 15 de outubro"
}
