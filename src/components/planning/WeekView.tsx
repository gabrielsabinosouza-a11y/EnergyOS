"use client";

import type { WeeklyPlanItem } from "@/types";
import { addDays, todayIso } from "@/lib/planning/dates";
import { SHORT_WEEKDAYS } from "@/lib/planning/dates";
import { TaskCard } from "@/components/planning/TaskCard";

interface WeekViewProps {
  weekRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
}

export function WeekView({
  weekRange: range,
  plans,
  selectedDate,
  onDateSelect,
  onPlanCreate,
  onToggleCompleted,
  onDelete,
}: WeekViewProps) {
  const today = todayIso();

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(range.start, i);
    const dayPlans = plans
      .filter((p) => p.planDate === date)
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    return {
      date,
      dayName: SHORT_WEEKDAYS[i],
      dayNumber: parseInt(date.slice(8, 10), 10),
      plans: dayPlans,
      isToday: date === today,
      isSelected: date === selectedDate,
    };
  });

  return (
    <div
      className="w-full grid grid-cols-1 sm:grid-cols-7 gap-3 sm:gap-4"
      style={{ minWidth: 0 }}
    >
      {days.map((day) => (
        <DayColumn
          key={day.date}
          day={day}
          onDateSelect={onDateSelect}
          onPlanCreate={onPlanCreate}
          onToggleCompleted={onToggleCompleted}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface DayColumnProps {
  day: {
    date: string;
    dayName: string;
    dayNumber: number;
    plans: WeeklyPlanItem[];
    isToday: boolean;
    isSelected: boolean;
  };
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
}

function DayColumn({
  day,
  onDateSelect,
  onPlanCreate,
  onToggleCompleted,
  onDelete,
}: DayColumnProps) {

  return (
    <div
      className={`flex flex-col min-h-[420px] w-full rounded-xl border rounded-xl ${
        day.isSelected ? "ring-2 ring-[var(--accent)] ring-offset-1" : "border-[var(--border-subtle)]"
      } bg-[var(--bg-surface)] overflow-hidden`}
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {/* Header: clickable day -> Dia view */}
      <button
        type="button"
        onClick={() => onDateSelect(day.date)}
        aria-label={`Selecionar ${day.dayName}, ${day.dayNumber}`}
        className="flex flex-col items-center gap-1 p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/20 text-left hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded-t-lg transition-colors"
      >
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${
          day.isToday ? "text-[var(--accent)] font-bold" : "text-[var(--text-faint)]"
        }`}>{day.dayName}</span>
        <span className={`text-[20px] font-mono tabular-nums font-bold ${
          day.isToday ? "text-[var(--accent)]" : "text-[var(--text)]"
        }`}>{day.dayNumber}</span>
        {day.isToday && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        )}
      </button>

      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {day.plans.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center py-4 text-[12px] text-[var(--text-faint)]">
            Sem planos
          </div>
        )}

        {day.plans.map((plan) => {
          return (
            <div key={plan.id} className="group relative">
              <TaskCard
                plan={plan}
                onToggle={(completed) => onToggleCompleted(plan.id, completed)}
                onDelete={() => onDelete(plan.id)}
                alwaysShowActions
                compact
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onPlanCreate(day.date)}
        aria-label="Adicionar plano"
        className="mt-auto w-full border-t border-[var(--border-subtle)] px-2 py-2.5 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-bg)] flex items-center justify-center gap-1 transition-colors"
      >
        + Adicionar
      </button>
    </div>
  );
}
