"use client";

import { Check, Flame, Loader2, Pencil } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { HabitIcon } from "./habit-icon";
import { isHabitScheduledOnDate } from "@/lib/habit-schedule";
import { addDaysIso, weekStartIso } from "@/lib/db/dates";
import { ConsistencyHeatmap, activityDayFromHabit } from "./consistency-heatmap";
import { AnimatePresence, motion } from "framer-motion";

/** Abas do painel de hábitos (Hoje | Geral | Semanal). */
export type HabitTab = "hoje" | "geral" | "semanal";
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
  year: number;
  tab: HabitTab;
  busyTaskId: number | null;
  onToggle: (task: UserDailyTask, completed: boolean) => void;
  onEdit?: (task: UserDailyTask) => void;
}

/** Card de um hábito — ícone, nome, sequência, check-in e mapa de contribuição. */
export function HabitCard({ task, logs, today, year, tab, busyTaskId, onToggle, onEdit }: HabitCardProps) {
  const color = task.color || ["#71d4ff", "#b69cff", "#a3e635", "#ffb86b", "#6bffb8"][(task.id - 1) % 5];
  const streak = habitStreak(task, logs, today);
  const doneToday = isDayDone(logs, today);
  const scheduledToday = isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, today);
  const todayBusy = busyTaskId === task.id;
  const checkIconColor = luminance(color) > 0.4 ? "#07111f" : "#ffffff";

  const weekStart = weekStartIso(today);
  const heatmapDays = Object.entries(logs)
    .filter(([date]) => date.startsWith(`${year}-`))
    .map(([date, completed]) => activityDayFromHabit(date, completed, today));
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

      <AnimatePresence mode="wait" initial={false}>
      {tab === "hoje" && (
        <motion.div key="hoje" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2.5">
          <span className="text-xs text-[var(--text-muted)]">Hoje, {fmtDay(today)}</span>
          <span className="text-xs font-semibold" style={{ color: doneToday ? color : "var(--text-muted)" }}>
            {doneToday ? "Feito" : scheduledToday ? "Pendente" : "Não programado"}
          </span>
        </motion.div>
      )}

      {/* Geral tab — full-width heatmap */}
      {tab === "geral" && (
        <motion.div key="geral" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="mt-3">
          <ConsistencyHeatmap year={year} days={heatmapDays} today={today} accent={color} variant="habit" summary={`${heatmapDays.filter((day) => day.dailyTaskCompletions).length} check-ins em ${year}`} />
        </motion.div>
      )}

      {/* Semanal tab */}
      {tab === "semanal" && (
        <motion.div key="semanal" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="mt-3 flex items-start justify-between gap-1">
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
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
