import type { StreakDayStatus } from "@/types";
import { addDaysIso, diffDaysIso, weekStartIso, getYearRange } from "./db/dates";

/**
 * Histórico de atividade diário — base do mapa de consistência.
 *
 * Consolida duas fontes por dia (YYYY-MM-DD, fuso America/Sao_Paulo):
 *   - check-in do dia (daily_checkins → /api/streak-calendar): "success" |
 *     "protected" (escudo) mantêm a sequência; "lost" quebra;
 *   - check-ins de tarefas diárias (daily_task_log → /api/daily-tasks/history).
 *
 * Todo o módulo é puro (sem I/O, sem Date()) para ser testável.
 */
export interface ActivityDay {
  date: string;
  /** Status do check-in do dia, quando houve (null = sem check-in). */
  checkin: StreakDayStatus | null;
  /** Tarefas diárias concluídas no dia. */
  dailyTaskCompletions?: number;
  /** @deprecated Nome legado; contém tarefas diárias, não metas. */
  goalLogs?: number;
  /** Dia ainda não aconteceu no fuso do produto. */
  future: boolean;
}

export interface ActivitySource {
  /** Record<YYYY-MM-DD, StreakDayStatus> como devolvido pelo streak-calendar. */
  checkins: Record<string, StreakDayStatus>;
  /** Record<YYYY-MM-DD, quantidade de tarefas diárias concluídas>. */
  dailyTaskCounts?: Record<string, number>;
  /** @deprecated Nome legado; contém tarefas diárias, não metas. */
  goalLogCounts?: Record<string, number>;
  /** Hoje (YYYY-MM-DD) no fuso oficial do produto. */
  today: string;
}

export interface ActivityStreaks {
  /** Dias consecutivos terminando em `endpoint` (hoje pendente não quebra). */
  current: number;
  /** Melhor sequência dentro do ano exibido. */
  best: number;
}

export interface ActivityStats extends ActivityStreaks {
  /** Dias com alguma atividade (check-in válido ou tarefa diária concluída). */
  activeDays: number;
  /** Check-ins de tarefas diárias no ano. */
  dailyTaskEntries: number;
  /** @deprecated Nome legado; contém tarefas diárias, não check-ins de metas. */
  goalLogEntries: number;
  /** DiasDecorridos de 01/01 até `endpoint` (limitado ao ano). */
  elapsedDays: number;
  /** activeDays / elapsedDays, em % arredondado (0 quando sem dias). */
  rate: number;
}

function dailyTaskCount(day: Pick<ActivityDay, "dailyTaskCompletions" | "goalLogs">): number {
  return day.dailyTaskCompletions ?? day.goalLogs ?? 0;
}

/** Dia "contou": check-in válido (ou protegido por escudo) OU tarefa diária concluída. */
export function isDayActive(day: ActivityDay): boolean {
  if (day.checkin === "success" || day.checkin === "protected") return true;
  return dailyTaskCount(day) > 0;
}

/**
 * Intensidade do dia no heatmap (0–3):
 *   score = (check-in válido ? 2 : 0) + min(tarefas diárias, 2)
 *   0 = nada · 1 = só 1 tarefa diária · 2 = check-in OU tarefas · 3 = ambos
 */
export function activityLevel(day: ActivityDay): 0 | 1 | 2 | 3 {
  const score = (day.checkin === "success" || day.checkin === "protected" ? 2 : 0) + Math.min(dailyTaskCount(day), 2);
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score === 2) return 2;
  return 3;
}

/** Grade completa do ano (01/01 → 31/12), inclusive dias futuros. */
export function buildActivityYear(year: number, source: ActivitySource): ActivityDay[] {
  const { start, end } = getYearRange(year);
  const days: ActivityDay[] = [];
  for (let date = start; date <= end; date = addDaysIso(date, 1)) {
    const dailyTaskCompletions = source.dailyTaskCounts?.[date] ?? source.goalLogCounts?.[date] ?? 0;
    days.push({
      date,
      checkin: source.checkins[date] ?? null,
      dailyTaskCompletions,
      goalLogs: dailyTaskCompletions,
      future: date > source.today,
    });
  }
  return days;
}

/**
 * Sequências sobre os dias de `endpoint` para trás (inclusive).
 * Regras (mesmas da streak.ts do produto):
 *  - hoje inativo ainda não qualificado → pulado, não quebra;
 *  - primeiro dia passado inativo → quebra.
 */
export function activityStreaks(days: ActivityDay[], endpoint: string): ActivityStreaks {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const activeAt = (date: string): boolean => {
    const day = byDate.get(date);
    return day ? isDayActive(day) : false;
  };

  let current = 0;
  for (let i = 0; i < 400; i += 1) {
    const cursor = addDaysIso(endpoint, -i);
    if (i === 0 && !activeAt(cursor)) continue; // hoje ainda pode vir a qualificar
    if (activeAt(cursor)) current += 1;
    else break;
  }

  let best =  0;
  let run = 0;
  for (const day of days) {
    if (isDayActive(day)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

/** Date keys included in the current streak, using the same rules as activityStreaks. */
export function activityCurrentStreakDates(days: ActivityDay[], endpoint: string): string[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const dates: string[] = [];
  for (let i = 0; i < 400; i += 1) {
    const cursor = addDaysIso(endpoint, -i);
    const active = byDate.has(cursor) && isDayActive(byDate.get(cursor)!);
    if (i === 0 && !active) continue;
    if (active) dates.push(cursor);
    else break;
  }
  return dates;
}

/** Estatísticas do ano exibido. `endpoint` = hoje (ano atual) ou 31/12 (ano passado). */
export function activityStats(days: ActivityDay[], endpoint: string): ActivityStats {
  const { start, end } = days.length
    ? { start: days[0].date, end: days[days.length - 1].date }
    : { start: endpoint, end: endpoint };
  const clamped = endpoint < start ? start : endpoint > end ? end : endpoint;

  let activeDays = 0;
  let dailyTaskEntries = 0;
  for (const day of days) {
    if (isDayActive(day)) activeDays += 1;
    dailyTaskEntries += dailyTaskCount(day);
  }

  const elapsedDays = Math.max(0, diffDaysIso(clamped, start) + 1);
  const streaks = activityStreaks(days, clamped);
  return {
    current: streaks.current,
    best: streaks.best,
    activeDays,
    dailyTaskEntries,
    goalLogEntries: dailyTaskEntries,
    elapsedDays,
    rate: elapsedDays > 0 ? Math.round((activeDays / elapsedDays) * 100) : 0,
  };
}

/**
 * Colunas do heatmap: semanas (segunda → domingo) que cobrem o ano inteiro.
 * A primeira coluna começa na segunda da semana de 01/01; a última termina no
 * domingo da semana de 31/12. Cada célula é uma data YYYY-MM-DD (podendo
 * escapar do ano — o componente oculta essas).
 */
export function heatmapColumns(year: number): string[][] {
  const { start, end } = getYearRange(year);
  const firstMonday = weekStartIso(start);
  const lastMonday = weekStartIso(end);
  const columns: string[][] = [];
  for (let monday = firstMonday; monday <= lastMonday; monday = addDaysIso(monday, 7)) {
    columns.push(Array.from({ length: 7 }, (_, offset) => addDaysIso(monday, offset)));
  }
  return columns;
}
