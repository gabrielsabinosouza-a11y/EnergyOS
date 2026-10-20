"use client";

import { useMemo } from "react";
import { todayIso, formatLocalDate } from "@/lib/planning/dates";
import type { WeeklyPlanItem } from "@/types";
import { PlannerTimeGrid, type TimeGridDay } from "./PlannerTimeGrid";
import { PlanRow } from "./PlanRow";
import { Plus } from "lucide-react";

interface DayViewProps {
  date: string;
  plans: WeeklyPlanItem[];
  onToggleCompleted: (plan: WeeklyPlanItem, completed: boolean) => void;
  onEditPlan: (plan: WeeklyPlanItem) => void;
  onDeletePlan: (plan: WeeklyPlanItem) => void;
  onPlanCreate: (date: string, minutes?: number) => void;
}

export function DayView({
  date,
  plans,
  onToggleCompleted,
  onEditPlan,
  onDeletePlan,
  onPlanCreate,
}: DayViewProps) {
  const isToday = date === todayIso();
  const weekday = formatLocalDate(date, { weekday: "long" });
  const dateLabel = formatLocalDate(date, { day: "numeric", month: "long", year: "numeric" });
  const sorted = useMemo(
    () => [...plans].sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")),
    [plans],
  );
  const gridDays: TimeGridDay[] = useMemo(
    () => [{
      date,
      today: isToday,
      selected: true,
      events: sorted.filter((plan) => Boolean(plan.startTime)),
    }],
    [date, isToday, sorted],
  );
  const nextEvent = sorted.find((plan) => !plan.completedAt && plan.startTime) ?? null;
  const completedCount = sorted.filter((plan) => Boolean(plan.completedAt)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 lg:flex-row">
      <section className="flex h-[42dvh] min-h-[280px] shrink-0 flex-col lg:h-auto lg:min-h-0 lg:flex-1" aria-label={`Agenda de ${weekday}, ${dateLabel}`}>
        {sorted.length === 0 ? (
          <button
            type="button"
            onClick={() => onPlanCreate(date)}
            aria-label={`Adicionar plano em ${dateLabel}`}
            className="group flex h-full min-h-[260px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border border-[var(--border-subtle)] text-[var(--accent)] transition-colors group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-bg)]">
              <Plus size={24} aria-hidden="true" />
            </span>
            <span className="mt-4 text-base font-semibold text-[var(--text)]">Nenhum plano para este dia</span>
            <span className="mt-1 text-sm text-[var(--text-secondary)]">Criar um plano para {weekday}</span>
          </button>
        ) : (
          <PlannerTimeGrid
            days={gridDays}
            onSlotClick={(selectedDay, minutes) => onPlanCreate(selectedDay, minutes)}
            onEventClick={onEditPlan}
          />
        )}
      </section>

      <aside className="flex min-h-[260px] min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 lg:min-h-0 lg:w-[340px] lg:flex-none lg:overflow-y-auto">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{weekday}</p>
            <h2 className={`mt-1 truncate text-lg font-bold capitalize ${isToday ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
              {dateLabel}
            </h2>
          </div>
          {sorted.length > 0 ? (
            <button
              type="button"
              onClick={() => onPlanCreate(date)}
              aria-label={`Adicionar plano em ${dateLabel}`}
              title="Adicionar plano"
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--accent)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Planos</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{sorted.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Concluídos</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--green)]">{completedCount}</p>
          </div>
        </div>

        {nextEvent ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Próximo evento</p>
            <button type="button" onClick={() => onEditPlan(nextEvent)} className="mt-2 min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{nextEvent.title || "(sem título)"}</span>
              <span className="text-[11px] tabular-nums text-[var(--text-faint)]">
                {nextEvent.startTime}{nextEvent.durationMinutes ? ` · ${nextEvent.durationMinutes} min` : ""}
              </span>
            </button>
          </div>
        ) : null}

        <section className="flex min-w-0 flex-col gap-2" aria-labelledby="day-plan-list-title">
          <h3 id="day-plan-list-title" className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Todos os planos
          </h3>
          {sorted.length ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              {sorted.map((plan) => (
                <PlanRow
                  key={plan.seriesId !== null ? `series:${plan.seriesId}:${plan.planDate}` : `plan:${plan.id}`}
                  plan={plan}
                  onToggleCompleted={onToggleCompleted}
                  onEdit={onEditPlan}
                  onDelete={onDeletePlan}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-xs text-[var(--text-faint)]">
              Nenhum plano para este dia.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
