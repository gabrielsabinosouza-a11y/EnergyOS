"use client";

import type { ElementType } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export type PlanningView = "month" | "week" | "day";

interface PlanningToolbarProps {
  view: PlanningView;
  label: string;
  title?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: PlanningView) => void;
}

const VIEWS: { id: PlanningView; label: string; icon: ElementType }[] = [
  { id: "month", label: "Mês", icon: CalendarDays },
  { id: "week", label: "Semana", icon: CalendarDays },
  { id: "day", label: "Dia", icon: CalendarDays },
];

const PERIOD_NAMES: Record<PlanningView, string> = {
  month: "mês",
  week: "semana",
  day: "dia",
};

export function PlanningToolbar({ view, label, title, onPrev, onNext, onToday, onViewChange }: PlanningToolbarProps) {
  const reduced = useReducedMotion();
  const dateLabel = title ?? label;

  return (
    <header className="grid min-w-0 grid-cols-2 items-center gap-x-4 gap-y-2.5 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto]">
      <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 sm:col-span-1 lg:col-span-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_4px_14px_var(--accent-glow)]">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--text)]">Planejamento</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label={`Período anterior (${PERIOD_NAMES[view]})`}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToday}
            aria-label="Ir para hoje"
            className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={`Próximo período (${PERIOD_NAMES[view]})`}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <h2
        className="col-span-2 min-w-0 truncate text-center text-base font-semibold capitalize tracking-tight text-[var(--text)] sm:text-lg lg:col-span-1 lg:text-left"
        data-testid="planner-title"
        aria-live="polite"
      >
        {dateLabel}
      </h2>

      <div
        className="col-span-2 flex min-w-0 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 lg:col-span-1 lg:col-start-auto lg:row-start-auto"
        role="group"
        aria-label="Modo de visualização"
      >
        {VIEWS.map(({ id, label: viewLabel, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              aria-pressed={active}
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] sm:px-3 ${
                active ? "text-[var(--bg-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="planner-view-active"
                  className="absolute inset-0 rounded-lg bg-[var(--accent)]"
                  transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
                />
              ) : null}
              <Icon size={14} className="relative shrink-0" aria-hidden="true" />
              <span className="relative truncate">{viewLabel}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
