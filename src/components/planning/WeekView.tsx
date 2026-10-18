"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import type { WeeklyPlanItem } from "@/types";
import { addDays, formatLocalDate, todayIso } from "@/lib/planning/dates";
import { PlanRow, planItemKey } from "./PlanRow";

interface WeekDay {
  date: string;
  dayName: string;
  dayNumber: number;
  plans: WeeklyPlanItem[];
  isToday: boolean;
  isSelected: boolean;
}

interface WeekViewProps {
  weekRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
  onToggleCompleted: (plan: WeeklyPlanItem, completed: boolean) => void;
  onEditPlan: (plan: WeeklyPlanItem) => void;
  onDeletePlan: (plan: WeeklyPlanItem) => void;
}

export function WeekView({
  weekRange,
  plans,
  selectedDate,
  onDateSelect,
  onPlanCreate,
  onToggleCompleted,
  onEditPlan,
  onDeletePlan,
}: WeekViewProps) {
  const reduced = useReducedMotion();
  const today = todayIso();
  const days = useMemo<WeekDay[]>(() => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekRange.start, index);
    return {
      date,
      dayName: formatLocalDate(date, { weekday: "short" }),
      dayNumber: Number(date.slice(8, 10)),
      plans: plans.filter((plan) => plan.planDate === date),
      isToday: date === today,
      isSelected: date === selectedDate,
    };
  }), [plans, selectedDate, today, weekRange.start]);
  const planCount = days.reduce((total, day) => total + day.plans.length, 0);
  const isCurrentWeek = days.some((day) => day.isToday);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4" aria-label="Planejador semanal">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {isCurrentWeek ? "Esta semana" : "Semana selecionada"}
          </span>
          {isCurrentWeek ? (
            <span className="shrink-0 rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
              Hoje
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-faint)]">
          <span>{planCount} {planCount === 1 ? "plano" : "planos"}</span>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-7">
        {days.map((day, index) => (
          <motion.article
            key={day.date}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.16, delay: reduced ? 0 : index * 0.015 }}
            className={`flex min-h-[150px] min-w-0 flex-col rounded-xl border bg-[var(--bg-surface)] p-2.5 transition-colors duration-150 ${
              day.isSelected
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent-bg)_26%,var(--bg-surface))] shadow-[inset_0_0_0_1px_var(--accent)]"
                : day.isToday
                  ? "border-[color-mix(in_srgb,var(--accent)_48%,var(--border-subtle))]"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                {day.dayName}
              </span>
              <button
                type="button"
                onClick={() => onDateSelect(day.date)}
                aria-label={`${day.dayNumber} ${formatLocalDate(day.date, { month: "long", year: "numeric" })}`}
                aria-current={day.isToday ? "date" : undefined}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                  day.isToday
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : day.isSelected
                      ? "border-2 border-[var(--accent)] text-[var(--accent)]"
                      : "border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text)] hover:border-[var(--border-strong)]"
                }`}
              >
                {day.dayNumber}
              </button>
            </div>

            {day.plans.length ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                {day.plans.map((plan) => (
                  <PlanRow
                    key={planItemKey(plan)}
                    plan={plan}
                    compact
                    onToggleCompleted={onToggleCompleted}
                    onEdit={onEditPlan}
                    onDelete={onDeletePlan}
                  />
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onPlanCreate(day.date)}
                className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label={`Criar plano em ${formatLocalDate(day.date, { weekday: "long", day: "numeric", month: "long" })}`}
              >
                <Plus size={16} aria-hidden="true" />
                Sem planos
              </button>
            )}

            <button
              type="button"
              onClick={() => onPlanCreate(day.date)}
              className="mt-auto flex min-h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-subtle)] px-2 text-[11px] font-medium text-[var(--text-faint)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label={`Adicionar plano para ${formatLocalDate(day.date, { weekday: "long", day: "numeric", month: "long" })}`}
            >
              <Plus size={12} aria-hidden="true" /> Adicionar
            </button>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
