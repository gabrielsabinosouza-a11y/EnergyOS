"use client";

import { Check, Loader2 } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { StreakIcon } from "@/components/streak-icon";
import { addDaysIso, weekStartIso } from "@/lib/db/dates";

/** Abas do painel de hábitos (Hoje | Geral | Semanal). */
export type HabitTab = "hoje" | "geral" | "semanal";

const WEEKS = 20;
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function withAlpha(hex: string, alpha: number): string {
  const short = hex.replace("#", "");
  const full = short.length === 3 ? short.split("").map((c) => c + c).join("") : short;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fmtDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)} de ${MONTH_LABELS[Number(month) - 1]}`;
}

function isDayDone(logs: Record<string, boolean>, date: string): boolean {
  return logs[date] === true;
}

/**
 * Sequência do hábito: dias consecutivos com check-in até hoje. Hoje pendente
 * NÃO quebra a sequência (pode vir a ser feito ainda); ontem perdido quebra.
 */
function habitStreak(logs: Record<string, boolean>, today: string): number {
  let cursor = isDayDone(logs, today) ? today : addDaysIso(today, -1);
  let streak = 0;
  while (streak < 400 && isDayDone(logs, cursor)) {
    streak += 1;
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
}

/** Card de um hábito diário — ícone personalizado, sequência, check-in e mapa próprio. */
export function HabitCard({ task, logs, today, tab, busyTaskId, onToggle }: HabitCardProps) {
  const color = task.color || ["#71d4ff", "#b69cff", "#a3e635", "#ffb86b", "#6bffb8"][(task.id - 1) % 5];
  const streak = habitStreak(logs, today);
  const doneToday = isDayDone(logs, today);
  const todayBusy = busyTaskId === task.id;

  const weekStart = weekStartIso(today);
  const columns: string[][] = [];
  for (let i = WEEKS - 1; i >= 0; i -= 1) {
    const start = addDaysIso(weekStart, -i * 7);
    columns.push(Array.from({ length: 7 }, (_, d) => addDaysIso(start, d)));
  }

  // Render icon
  const renderIcon = () => {
    if (task.iconType === "emoji") {
      return <span className="text-xl">{task.iconValue}</span>;
    }
    if (task.iconType === "image") {
      return <img src={task.iconValue} alt={task.title} className="h-5 w-5 rounded object-cover" />;
    }
    return (
      <img
        src={`/icons_8bits/${task.iconValue}`}
        alt={task.iconValue.replace(".png", "")}
        className="h-5 w-5 rounded"
      />
    );
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-xl p-2.5" style={{ backgroundColor: withAlpha(color, 0.15), color }}>
          {renderIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] text-[var(--text)]">{task.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <StreakIcon size={13} />
            {streak} {streak === 1 ? "dia" : "dias"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(task, !doneToday)}
          disabled={todayBusy}
          aria-label={doneToday ? `Desmarcar ${task.title} hoje` : `Marcar ${task.title} hoje`}
          title={doneToday ? "Desmarcar hoje" : "Marcar hoje"}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition disabled:opacity-60"
          style={
            doneToday
              ? { backgroundColor: color, color: "#07111f" }
              : { border: `2px solid ${withAlpha(color, 0.45)}`, background: withAlpha(color, 0.08), color }
          }
        >
          {todayBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
        </button>
      </div>

      {tab === "hoje" && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3.5 py-3">
          <span className="text-xs text-[var(--text-muted)]">Hoje, {fmtDay(today)}</span>
          <span className="text-xs font-semibold" style={{ color: doneToday ? color : "var(--text-muted)" }}>
            {doneToday ? "Feito ✓" : "Pendente"}
          </span>
        </div>
      )}

      {tab === "geral" && (
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex w-max gap-[3px]">
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
                      className="h-3 w-3 rounded-[3px] transition-colors"
                      style={{
                        backgroundColor: future
                          ? "var(--bg-surface-hover)"
                          : done
                            ? withAlpha(color, 0.9)
                            : withAlpha(color, 0.14),
                        boxShadow: isToday ? "0 0 0 1.5px var(--accent)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "semanal" && (
        <div className="mt-4 flex items-start justify-between gap-1">
          {WEEKDAY_LABELS.map((label, i) => {
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
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={
                    done
                      ? { backgroundColor: color, color: "#07111f" }
                      : { background: future ? "var(--bg-surface-hover)" : withAlpha(color, 0.14), color }
                  }
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : done ? (
                    <Check size={14} strokeWidth={3} />
                  ) : null}
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
