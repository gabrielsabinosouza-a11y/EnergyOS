"use client";

import { Check, Loader2, Pencil } from "lucide-react";
import Image from "next/image";
import type { UserDailyTask } from "@/types";
import { HabitIcon } from "./habit-icon";
import { isHabitScheduledOnDate } from "@/lib/habit-schedule";
import { addDaysIso, weekStartIso } from "@/lib/db/dates";
import { ConsistencyHeatmap, activityDayFromHabit } from "./consistency-heatmap";
import { AnimatePresence, motion } from "framer-motion";
import { STREAK_LOST_IMAGE, STREAK_SAVED_IMAGE } from "@/components/streak-icon";

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
function habitStreakDates(task: UserDailyTask, logs: Record<string, boolean>, today: string): string[] {
  let cursor = isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, today) && !isDayDone(logs, today)
    ? addDaysIso(today, -1)
    : today;
  const dates: string[] = [];
  while (dates.length < 400) {
    if (isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, cursor)) {
      if (!isDayDone(logs, cursor)) break;
      dates.push(cursor);
    }
    cursor = addDaysIso(cursor, -1);
  }
  return dates;
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
  onProgress: (task: UserDailyTask, completedCount: number) => void;
  onEdit?: (task: UserDailyTask) => void;
}

/** Card de um hábito — ícone, nome, sequência, check-in e mapa de contribuição. */
export function HabitCard({ task, logs, today, year, tab, busyTaskId, onProgress, onEdit }: HabitCardProps) {
  const dailyTarget = Math.max(1, task.dailyTarget ?? 1);
  const completedCount = Math.max(0, Math.min(dailyTarget, task.completedCount ?? (task.isCompleted ? dailyTarget : 0)));
  const color = task.color || ["#71d4ff", "#b69cff", "#a3e635", "#ffb86b", "#6bffb8"][(task.id - 1) % 5];
  const streakDates = habitStreakDates(task, logs, today);
  const streak = streakDates.length;
  const doneToday = completedCount >= dailyTarget;
  const scheduledToday = isHabitScheduledOnDate(task.frequencyType, task.frequencyDays, task.frequencyTarget, today);
  const todayBusy = busyTaskId === task.id;
  const checkIconColor = luminance(color) > 0.4 ? "#07111f" : "#ffffff";

  const weekStart = weekStartIso(today);
  const heatmapDays = Object.entries(logs)
    .filter(([date]) => date.startsWith(`${year}-`))
    .map(([date, completed]) => activityDayFromHabit(date, completed, today));
  const yearlyCheckIns = heatmapDays.filter((day) => day.dailyTaskCompletions).length;
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
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Image
              src={streak > 0 ? STREAK_SAVED_IMAGE : STREAK_LOST_IMAGE}
              alt={streak > 0 ? "Sequência ativa" : "Sem sequência ativa"}
              width={17}
              height={17}
              unoptimized
              className={streak > 0 ? "habit-streak-icon-active" : "habit-streak-icon-inactive"}
              style={{ width: 17, height: 17, objectFit: "contain" }}
            />
            {streak} {streak === 1 ? "dia" : "dias"}
          </p>
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
        <div className={`flex h-9 shrink-0 items-center overflow-hidden rounded-full border ${doneToday ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-[var(--border-strong)] text-[var(--text-secondary)]"}`} aria-label={`${task.title}: ${completedCount} de ${dailyTarget}`}>
          <button type="button" onClick={() => onProgress(task, Math.max(0, completedCount - 1))} disabled={todayBusy || !scheduledToday || completedCount === 0} aria-label={`Diminuir ${task.title}`} className="grid h-9 w-9 place-items-center transition hover:bg-white/5 disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">−</button>
          <span className="min-w-10 text-center font-mono text-xs font-semibold">{todayBusy ? <Loader2 size={13} className="mx-auto animate-spin" /> : `${completedCount}/${dailyTarget}`}{doneToday && <Check size={12} className="ml-1 inline" aria-label="Concluído" />}</span>
          <button type="button" onClick={() => onProgress(task, Math.min(dailyTarget, completedCount + 1))} disabled={todayBusy || !scheduledToday || doneToday} aria-label={`Aumentar ${task.title}`} className="grid h-9 w-9 place-items-center transition hover:bg-white/5 disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">+</button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {tab === "hoje" && (
        <motion.div key="hoje" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2.5">
          <span className="text-xs text-[var(--text-muted)]">Hoje, {fmtDay(today)}</span>
          <span className="text-xs font-semibold" style={{ color: doneToday ? "var(--green)" : "var(--text-muted)" }}>{doneToday ? "Meta diária concluída" : scheduledToday ? `${completedCount}/${dailyTarget} · Em andamento` : "Não programado"}</span>
          <div className="ml-3 h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-surface-active)]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.round(completedCount / dailyTarget * 100)}%` }} /></div>
        </motion.div>
      )}

      {/* Geral tab — full-width heatmap */}
      {tab === "geral" && (
        <motion.div key="geral" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="mt-3">
          <ConsistencyHeatmap year={year} days={heatmapDays} today={today} accent={color} variant="habit" showLegend={false} streakDates={streakDates} summary={`${yearlyCheckIns} check-in${yearlyCheckIns === 1 ? "" : "s"} em ${year}`} />
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
                  onClick={() => isToday && onProgress(task, done ? 0 : dailyTarget)}
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
