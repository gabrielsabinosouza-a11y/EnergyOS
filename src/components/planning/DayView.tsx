"use client";

import type { WeeklyPlanItem } from "@/types";
import { todayIso, formatLocalDate } from "@/lib/planning/dates";
import { TaskCard } from "@/components/planning/TaskCard";
import { Plus, Pencil } from "lucide-react";

interface DayViewProps {
  date: string;
  plans: WeeklyPlanItem[];
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onPlanCreate: (date: string) => void;
  /** Keyboard shortcut hint to display on the header button (e.g., "N"). */
  shortcutHint?: string;
}

export function DayView({ date, plans, onToggleCompleted, onDelete, onPlanCreate, shortcutHint }: DayViewProps) {
  const today = todayIso();
  const isToday = date === today;
  const weekday = formatLocalDate(date, { weekday: "long" }); // "quinta-feira"
  const dateLabel = formatLocalDate(date, { day: "numeric", month: "short", year: "numeric" }); // "15 de out. de 2026"
  const sorted = [...plans].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  const isEmpty = sorted.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${isToday ? "text-[var(--accent)]" : ""}`}>
            {weekday}
          </h2>
          <p className={`text-[var(--text-faint)] text-sm ${isToday ? "font-medium" : ""}`}>
            {dateLabel}
            {isToday ? " · hoje" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPlanCreate(date)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          aria-label="Adicionar plano"
        >
          {shortcutHint && (
            <kbd className="relative -top-0.5 -mb-0.5 mr-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--text)] leading-none">
              {shortcutHint}
            </kbd>
          )}
          <Pencil size={16} /> Adicionar plano
        </button>
      </div>

      {isEmpty ? (
        <EmptyState onAdd={() => onPlanCreate(date)} weekday={weekday} dateLabel={dateLabel} />
      ) : (
        <PlansList
          plans={sorted}
          onToggleCompleted={onToggleCompleted}
          onDelete={onDelete}
          onAdd={() => onPlanCreate(date)}
        />
      )}
    </div>
  );
}

interface EmptyStateProps {
  weekday: string;
  dateLabel: string;
  onAdd: () => void;
}

function EmptyState({ weekday, dateLabel, onAdd }: EmptyStateProps) {
  const dateLabelLower = dateLabel.toLowerCase();
  return (
    <button
      type="button"
      onClick={onAdd}
      className="day-empty-state group relative flex flex-col items-center justify-center text-center"
      aria-label={`Adicionar plano para ${weekday}, ${dateLabelLower}`}
    >
      <span className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[var(--accent-bg)] flex items-center justify-center">
        <span className="dot-pulse absolute w-16 h-16 rounded-full bg-[var(--accent)] opacity-20"></span>
        <Plus size={24} className="relative z-10 text-[var(--accent)] group-hover:scale-110 transition-transform duration-200" aria-hidden="true" />
      </span>
      <p className="text-[var(--text)] font-semibold mb-4 relative z-10 text-base">Nenhum plano para este dia</p>
      <p className="text-[var(--text-secondary)] text-sm mb-6 relative z-10">Clique para criar seu primeiro plano</p>
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-base font-bold text-[var(--bg-primary)] shadow-[0_0_16px_var(--accent-glow)] hover:shadow-[0_0_24px_var(--accent-glow)] transition-shadow duration-200 relative z-10">
        Adicionar plano
      </span>
    </button>
  );
}

interface PlansListProps {
  plans: WeeklyPlanItem[];
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

function PlansList({ plans, onToggleCompleted, onDelete, onAdd }: PlansListProps) {
  return (
    <div className="flex flex-col gap-2">
      {plans.map((plan) => (
        <div key={plan.id} className="group relative">
          <TaskCard
            plan={plan}
            onToggle={(completed) => onToggleCompleted(plan.id, completed)}
            onDelete={() => onDelete(plan.id)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="day-view-add-row"
        aria-label="Adicionar plano"
      >
        + Adicionar plano
      </button>
    </div>
  );
}