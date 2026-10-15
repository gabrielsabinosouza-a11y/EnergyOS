"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { viewLabel } from "@/lib/planning/dates";

type PlanningView = "month" | "week" | "day";

interface PlanningToolbarProps {
  selectedDate: string;
  view: PlanningView;
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

export function PlanningToolbar({ selectedDate, view, onPrev, onNext, onToday, onViewChange }: PlanningToolbarProps) {
  const label = viewLabel(selectedDate, view);

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={20} className="text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Planejamento</h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            aria-label="Anterior"
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
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="text-sm font-medium text-[var(--text-secondary)]">{label}</div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
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
