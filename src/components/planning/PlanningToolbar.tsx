"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export type PlanningView = "month" | "week" | "day";

interface PlanningToolbarProps {
  view: PlanningView;
  label: string;
  /** Título principal (ex.: "Outubro de 2026" no mês). Maior e mais proeminente. */
  title?: string;
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

export function PlanningToolbar({ view, label, title, onPrev, onNext, onToday, onViewChange }: PlanningToolbarProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-[var(--accent)]" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-[var(--text)]">Planejamento</h1>
        </div>

        {/* Navegação (< Hoje >) */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-hover)]"
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-md px-3 py-1 text-[13px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
            aria-label="Hoje"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-hover)]"
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-start">
        {/* Título principal — maior e mais proeminente na vista de mês. */}
        <h2
          className="min-w-0 flex-1 truncate text-center text-2xl font-bold tracking-tight text-[var(--text)] sm:text-left"
          data-testid="planner-title"
        >
          {title ?? label}
        </h2>

        {/* Switcher Mês/Semana/Dia */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          {VIEWS.map(({ id, label: viewLabel }) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                view === id
                  ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
              }`}
              aria-pressed={view === id}
            >
              {viewLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
