"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type PlanningView = "month" | "week" | "day";

interface PlanningToolbarProps {
  view: PlanningView;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: PlanningView) => void;
}

const VIEWS: { id: PlanningView; label: string }[] = [
  { id: "month", label: "Mês" },
  { id: "week", label: "Semana" },
  { id: "day", label: "Dia" },
];

export function PlanningToolbar({ view, label, onPrev, onNext, onToday, onViewChange }: PlanningToolbarProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={20} className="text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Planejamento</h1>
      </div>

      <div className="flex w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shrink-0">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="px-3 py-1 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--accent-bg)] rounded-md transition-colors"
            aria-label="Hoje"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            aria-label="Mês seguinte"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="min-w-0 flex-1 text-sm font-medium text-[var(--text-secondary)] text-center sm:text-left leading-tight">
          {label}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shrink-0">
          {VIEWS.map(({ id, label: labelName }) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                view === id
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
              aria-pressed={view === id}
            >
              {labelName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
