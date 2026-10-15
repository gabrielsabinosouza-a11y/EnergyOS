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
      className="w-full grid grid-cols-1 lg:grid-cols-7 gap-3 lg:gap-4"
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
      className={`flex flex-col min-w-[140px] rounded-xl border bg-[var(--bg-surface)] overflow-hidden transition-colors ${
        day.isSelected
          ? "ring-2 ring-[var(--accent)] ring-offset-1 border-[var(--border-subtle)]"
          : day.isToday
            ? "border-[var(--accent)]/50"
            : "border-[var(--border-subtle)]"
      }`}
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {/* Header: clickable day -> Dia view */}
      <button
        type="button"
        onClick={() => onDateSelect(day.date)}
        aria-label={`Selecionar ${day.dayName}, ${day.dayNumber}`}
        className={`flex flex-col items-center gap-1 p-2 border-b border-[var(--border-subtle)] text-left transition-colors ${
          day.isSelected
            ? "bg-[var(--accent-bg)] text-[var(--accent)]"
            : day.isToday
              ? "bg-[var(--accent-bg)]/50 text-[var(--accent)]"
              : "bg-[var(--bg-surface-hover)]/30 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
        }}`}
      >
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${day.isToday ? "font-bold" : ""}`}>
          {day.dayName}
        </span>
        <span className={`text-[20px] font-mono tabular-nums font-bold ${day.isToday || day.isSelected ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
          {day.dayNumber}
        </span>
      </button>

      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto min-h-0">
        {day.plans.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center py-6 text-[12px] text-[var(--text-faint)]">
            Sem planos
          </div>
        )}

        {day.plans.map((plan) => (
          <div key={plan.id} className="group relative">
            <TaskCard
              plan={plan}
              onToggle={(completed) => onToggleCompleted(plan.id, completed)}
              onDelete={() => onDelete(plan.id)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPlanCreate(day.date)}
        aria-label="Adicionar plano"
        className="mt-2 w-full border-t border-[var(--border-subtle)] pt-2 px-2 py-2.5 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-bg)] flex items-center justify-center gap-1 transition-colors"
      >
        + Adicionar
      </button>
    </div>
  );
}
