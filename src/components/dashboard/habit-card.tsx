"use client";

import { Check, Flame, Loader2, Pencil } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { HabitIcon } from "./habit-icon";
import { isHabitScheduledOnDate } from "@/lib/habit-schedule";
import { addDaysIso, weekStartIso } from "@/lib/db/dates";

/** Abas do painel de hábitos (Hoje | Geral | Semanal). */
export type HabitTab = "hoje" | "geral" | "semanal";

const WEEKS = 20;
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function hexAlpha(hex: string, alpha: number): string {
  const short = hex.replace("#", "");
  const full = short.length === 3 ? short.split("").map((c) => c + c).join("") : short;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(113, 212, 255, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Compute relative luminance to decide check icon color (white vs dark). */
function luminance(hex: string): number {
  const short = hex.replace("#", "");
  const full = short.length === 3 ? short.split("").map((c) => c + c).join("") : short;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return 1;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function fmtDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)} ${MONTH_LABELS[Number(month) - 1]}`;
}

function fmtDayShort(date: string): string {
  const [, , day] = date.split("-");
  return day;
}

function isDayDone(logs: Record<string, boolean>, date: string): boolean {
  return logs[date] === true;
}

/**
 * Sequência do hábito: dias consecutivos com check-in até hoje.
 */
function habitStreak(task: UserDailyTask, logs: Record<string, boolean>, today: string): number {
  let cursor = isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, today) && !isDayDone(logs, today)
    ? addDaysIso(today, -1)
    : today;
  let streak = 0;
  while (streak < 400) {
    if (isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, cursor)) {
      if (!isDayDone(logs, cursor)) break;
      streak += 1;
    }
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

interface HabitCardProps {
  task: UserDailyTask;
  /** Date YYYY-MM-DD -> conclusão da tarefa nesse dia. */
  logs: Record<string, boolean>;
  /** Hoje no fuso America/Sao_Paulo. */
  today: string;
  tab: HabitTab;
  busyTaskId: number | null;
  onToggle: (task: UserDailyTask, completed: boolean) => void;
  onEdit?: (task: UserDailyTask) => void;
}

/** Heatmap intensity levels based on habit color. */
const HEATMAP_LEVELS = [0.12, 0.35, 0.55, 0.85];

/** Card de um hábito — ícone, nome, sequência, check-in e mapa de contribuição. */
export function HabitCard({ task, logs, today, tab, busyTaskId, onToggle, onEdit }: HabitCardProps) {
  const color = task.color || ["#71d4ff", "#b69cff", "#a3e635", "#ffb86b", "#6bffb8"][(task.id - 1) % 5];
  const streak = habitStreak(task, logs, today);
  const doneToday = isDayDone(logs, today);
  const scheduledToday = isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, today);
  const todayBusy = busyTaskId === task.id;
  const checkIconColor = luminance(color) > 0.4 ? "#07111f" : "#ffffff";

  const weekStart = weekStartIso(today);
  const columns: string[][] = [];
  for (let i = WEEKS - 1; i >= 0; i -= 1) {
    const start = addDaysIso(weekStart, -i * 7);
    columns.push(Array.from({ length: 7 }, (_, d) => addDaysIso(start, d)));
  }

  // Group columns by month for labels
  const monthBoundaries: { month: number; colIndex: number }[] = [];
  let prevMonth = -1;
  columns.forEach((col, ci) => {
    const month = Number(col[0].split("-")[1]);
    if (month !== prevMonth) {
      monthBoundaries.push({ month, colIndex: ci });
      prevMonth = month;
    }
  });

  return (
    <div
      className="group/card rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3.5 sm:p-4 transition-colors hover:border-[var(--border-strong)]"
      style={{ "--habit-color": color } as React.CSSProperties}
    >
      {/* Header row: icon + name/streak + edit + check */}
      <div className="flex items-center gap-3">
        <HabitIcon habit={task} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[15px] text-[var(--text)]">{task.title}</p>
          {streak > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Flame size={12} className="text-orange-400" />
              {streak} {streak === 1 ? "dia" : "dias"}
            </p>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Editar ${task.title}`}
            title="Editar hábito"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] group-hover/card:opacity-100"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggle(task, !doneToday)}
          disabled={todayBusy || !scheduledToday}
          aria-label={!scheduledToday ? `${task.title} não está programado para hoje` : doneToday ? `Desmarcar ${task.title} hoje` : `Marcar ${task.title} hoje`}
          title={doneToday ? "Desmarcar hoje" : "Marcar hoje"}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={
            doneToday
              ? { backgroundColor: color, color: checkIconColor }
              : { border: `2px solid ${hexAlpha(color, 0.4)}`, background: hexAlpha(color, 0.08), color }
          }
        >
          {todayBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
        </button>
      </div>

      {/* Hoje tab */}
      {tab === "hoje" && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2.5">
          <span className="text-xs text-[var(--text-muted)]">Hoje, {fmtDay(today)}</span>
          <span className="text-xs font-semibold" style={{ color: doneToday ? color : "var(--text-muted)" }}>
            {doneToday ? "Feito" : scheduledToday ? "Pendente" : "Não programado"}
          </span>
        </div>
      )}

      {/* Geral tab — full-width heatmap */}
      {tab === "geral" && (
        <div className="mt-3">
          {/* Weekday labels on the left — align with rows 0 (Seg), 2 (Qua), 4 (Sex) */}
          <div className="flex">
            <div className="shrink-0 pr-1" style={{ width: 22 }}>
              {Array.from({ length: 7 }, (_, row) => {
                const label = row === 0 ? "Seg" : row === 2 ? "Qua" : row === 4 ? "Sex" : "";
                return (
                  <div key={row} className="flex h-[14px] items-center text-[9px] text-[var(--text-faint)]">
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              {/* Month labels */}
              <div className="relative mb-0.5">
                {monthBoundaries.map(({ month, colIndex }) => (
                  <span
                    key={colIndex}
                    className="absolute text-[9px] text-[var(--text-faint)]"
                    style={{ left: `${(colIndex / WEEKS) * 100}%` }}
                  >
                    {MONTH_LABELS[month - 1]}
                  </span>
                ))}
              </div>
              {/* Grid */}
              <div className="flex gap-[3px]">
                {columns.map((column) => (
                  <div key={column[0]} className="grid grid-rows-7 gap-[3px]">
                    {column.map((date) => {
                      const future = date > today;
                      const done = !future && isDayDone(logs, date);
                      const isToday = date === today;
                      const label = future
                        ? `${fmtDay(date)} — ainda vai acontecer`
                        : done
                          ? `${fmtDay(date)} — feito`
                          : `${fmtDay(date)} — não feito`;
                      return (
                        <div
                          key={date}
                          role="gridcell"
                          aria-label={label}
                          title={label}
                          tabIndex={0}
                          className="h-[14px] w-[14px] rounded-[3px] transition-colors"
                          style={{
                            backgroundColor: future
                              ? "var(--bg-surface-hover)"
                              : done
                                ? hexAlpha(color, HEATMAP_LEVELS[3])
                                : hexAlpha(color, HEATMAP_LEVELS[0]),
                            boxShadow: isToday ? `0 0 0 1.5px ${color}` : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] text-[var(--text-faint)]">
                <span>Menos</span>
                {HEATMAP_LEVELS.map((level, i) => (
                  <div
                    key={i}
                    className="h-[10px] w-[10px] rounded-[2px]"
                    style={{ backgroundColor: hexAlpha(color, level) }}
                  />
                ))}
                <span>Mais</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Semanal tab */}
      {tab === "semanal" && (
        <div className="mt-3 flex items-start justify-between gap-1">
          {(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const).map((label, i) => {
            const date = addDaysIso(weekStart, i);
            const future = date > today;
            const done = !future && isDayDone(logs, date);
            const busy = busyTaskId === task.id && date === today;
            const isToday = date === today;
            return (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => isToday && onToggle(task, !done)}
                  disabled={future || !isToday || busy}
                  aria-label={`${done ? "Desmarcar" : "Marcar"} ${fmtDay(date)}`}
                  title={future ? `${fmtDay(date)} — ainda vai acontecer` : `${fmtDay(date)} — ${done ? "feito" : "não feito"}`}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={
                    done
                      ? { backgroundColor: color, color: checkIconColor }
                      : { background: future ? "var(--bg-surface-hover)" : hexAlpha(color, 0.14), color: hexAlpha(color, 0.6) }
                  }
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : done ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)]">{fmtDayShort(date)}</span>
                  )}
                </button>
                <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
