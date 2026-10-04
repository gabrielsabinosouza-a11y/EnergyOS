/**
 * Modelo de domínio v2 — a terminologia nova do produto.
 *
 *   HÁBITO (habit)       → repete TODOS os dias (o antigo card "Tarefas diárias").
 *   META (goal)          → tem FIM: alvo numérico + prazo opcional. Conclui UMA vez.
 *                         NÃO tem mais frequência (daily/weekly/monthly).
 *   PLANEJAMENTO (item)  → tarefa/evento colocado num dia do "Plano da semana",
 *                         de uma vez ou fixo (repetição).
 *
 * Este arquivo é a fonte única do modelo novo. Ele é ADITIVO de propósito: o
 * `types/index.ts` ainda exporta os tipos legados (Goal/Habit com frequency)
 * porque nada aqui pode quebrar a UI antes da fase 2 trocar a importação.
 *
 * Datas são sempre YYYY-MM-DD no fuso America/Sao_Paulo (ver `lib/db/dates`).
 */
import type { Category } from "./index";

/** Hábito: repete todo dia; concluído por dia. */
export interface Habit {
  id: number;
  title: string;
  categoryId: number;
  category?: Category | null;
  /** false = arquivado (some da lista diária, mantém o histórico). */
  active: boolean;
  sortOrder?: number;
  /** ISO */
  createdAt: string;
  /** Conclusão de HOJE (YYYY-MM-DD) — campo de leitura, nunca o estado real. */
  completedOn?: string | null;
}

/** Meta: alvo com fim. Concluída quando current >= target. */
export interface Goal {
  id: number;
  title: string;
  categoryId: number;
  category?: Category | null;
  target: number;
  /** Unidade livre opcional: "livros", "horas", "páginas"... */
  unit?: string | null;
  current: number;
  /** Prazo opcional (YYYY-MM-DD). */
  deadline?: string | null;
  /** ISO — preenchido quando current >= target e removido se o progresso cair. */
  completedAt?: string | null;
  /** ISO */
  createdAt: string;
}

export type PlannerItemKind = "task" | "event";

export type PlannerRecurrenceType = "none" | "weekly" | "monthly" | "yearly";

/**
 * Regra de repetição do planejamento. Nunca geramos cópias: as ocorrências são
 * expandidas em memória (getOccurrencesInRange) para o intervalo visível.
 */
export interface PlannerRecurrence {
  type: PlannerRecurrenceType;
  /** 0 = Dom ... 6 = Sáb. Vários dias => "Toda semana: Seg + Qua". */
  weekdays?: number[];
  /** "a cada N semanas" (default 1). */
  intervalWeeks?: number | null;
  /** Data final da repetição (YYYY-MM-DD), inclusive. */
  until?: string | null;
}

/**
 * Um ÚNICO documento por item de planejamento — nunca um por ocorrência.
 * A data é a âncora (dia único ou primeira ocorrência).
 */
export interface PlannerItem {
  id: number;
  title: string;
  categoryId: number;
  category?: Category | null;
  kind: PlannerItemKind;
  /** Âncora YYYY-MM-DD. */
  date: string;
  /** "HH:mm" local; null quando allDay. */
  time?: string | null;
  allDay: boolean;
  recurrence: PlannerRecurrence;
  /** Ocorrência específica ignorada ("Só esta ocorrência") — YYYY-MM-DD[]. */
  skippedDates: string[];
  /** ISO */
  createdAt: string;
}

/** Conclusão de uma ocorrência: sempre `${itemId}_${YYYY-MM-DD}`. */
export interface PlannerCompletion {
  itemId: number;
  /** YYYY-MM-DD */
  date: string;
  /** ISO */
  completedAt?: string | null;
}

/** Id determinístico do log de hábito (equivale ao documento do histórico). */
export function habitLogDocId(habitId: number, date: string): string {
  return `${habitId}_${date}`;
}

/** Id determinístico da conclusão de um item do planejamento. */
export function plannerCompletionDocId(itemId: number, date: string): string {
  return `${itemId}_${date}`;
}