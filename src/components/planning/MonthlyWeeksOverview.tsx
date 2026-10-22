
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, CalendarDays, Sparkles } from "lucide-react";
import type { WeeklyPlanItem } from "@/types";
import {
  addDays,
  formatLocalDate,
  todayIso,
  weekRange,
} from "@/lib/planning/dates";

type Props = {
  monthStart: string;
  monthEnd: string;
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
};

type CalendarDay = {
  date: string;
  plans: WeeklyPlanItem[];
};

type CalendarWeek = {
  start: string;
  days: Array<CalendarDay | null>;
};

const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export function MonthlyWeeksOverview({
  monthStart,
  monthEnd,
  plans,
  selectedDate,
  onDateSelect,
  onPlanCreate,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const timeout = window.setTimeout(() => setToday(todayIso()), 0);
    return () => window.clearTimeout(timeout);
  }, []);
      const plansByDate = useMemo(() => {
    const grouped = new Map<string, WeeklyPlanItem[]>();

    for (const plan of plans) {
      if (!plan.planDate) continue;

      const current = grouped.get(plan.planDate) ?? [];
      current.push(plan);
      grouped.set(plan.planDate, current);
    }

    return grouped;
  }, [plans]);



  const weeks = useMemo(() => {
    const result: CalendarWeek[] = [];
    let cursor = weekRange(monthStart).start;

    while (cursor <= monthEnd) {
      const weekStart = cursor;
      const days: Array<CalendarDay | null> = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);

        if (date < monthStart || date > monthEnd) {
          days.push(null);
          continue;
        }

        days.push({
          date,
          plans: plansByDate.get(date) ?? [],
        });
      }

      result.push({ start: weekStart, days });
      cursor = addDays(weekStart, 7);
    }

    return result;
  }, [monthStart, monthEnd, plansByDate]);

  const totalPlans = plans.length;
  const completedPlans = plans.filter((plan) => Boolean(plan.completedAt)).length;
  const completionRate =
    totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

  const entrance = reduceMotion
    ? { opacity: 1, y: 0 }
    : { opacity: 0, y: 14 };

  const visible = { opacity: 1, y: 0 };

  return (
    <motion.section
      initial={entrance}
      animate={visible}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
      }
      className="group/month relative isolate overflow-hidden rounded-2xl border border-cyan-300/[0.12] bg-slate-950/65 p-3 shadow-[0_12px_45px_-22px_rgba(0,190,255,0.18),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-2xl sm:p-4"
    >
      {/* Ambient glass lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
      >
        <div className="absolute -right-24 -top-32 h-64 w-64 rounded-full bg-cyan-400/[0.07] blur-3xl transition-opacity duration-500 group-hover/month:bg-cyan-400/[0.11]" />
        <div className="absolute -bottom-36 -left-24 h-56 w-56 rounded-full bg-blue-500/[0.06] blur-3xl" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
      </div>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <motion.div
            whileHover={reduceMotion ? undefined : { rotate: -6, scale: 1.06 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.18] to-blue-500/[0.08] text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.09),inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <CalendarDays size={17} />
          </motion.div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">
              Visão mensal
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              Todas as semanas de{" "}
              {formatLocalDate(monthStart, {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {totalPlans > 0 && (
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-400/[0.05] px-2.5 py-1 sm:flex">
              <Sparkles size={11} className="text-emerald-300" />
              <span className="text-[10px] font-medium tabular-nums text-emerald-200/80">
                {completionRate}%
              </span>
            </div>
          )}

          <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[10px] tabular-nums text-slate-400">
            {weeks.length} semanas
          </span>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label, index) => (
          <motion.div
            key={label}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.025 }}
            className="pb-1 text-center text-[9px] font-semibold tracking-[0.12em] text-slate-500 sm:text-[10px]"
          >
            {label}
          </motion.div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weeks.map((week, weekIndex) =>
          week.days.map((day, dayIndex) => {
            if (!day) {
              return (
                <div
                  key={`${week.start}-empty-${dayIndex}`}
                  className="min-h-[58px] rounded-lg sm:min-h-[68px]"
                  aria-hidden="true"
                />
              );
            }

            const isSelected = day.date === selectedDate;
            const isToday = day.date === today;
            const completed = day.plans.filter(
              (plan) => Boolean(plan.completedAt),
            ).length;
            const pending = day.plans.length - completed;

            return (
              <motion.div
                key={day.date}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  layout: { type: "spring", stiffness: 350, damping: 30 },
                  opacity: {
                    duration: reduceMotion ? 0 : 0.24,
                    delay: reduceMotion ? 0 : weekIndex * 0.035 + dayIndex * 0.012,
                  },
                  y: {
                    duration: reduceMotion ? 0 : 0.3,
                    delay: reduceMotion ? 0 : weekIndex * 0.035 + dayIndex * 0.012,
                  },
                  scale: { duration: 0.25 },
                }}
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        y: -2,
                        rotateX: 2,
                        scale: 1.015,
                        transition: {
                          type: "spring",
                          stiffness: 380,
                          damping: 25,
                        },
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                style={{ transformPerspective: 800 }}
                className={`group/day relative min-h-[58px] overflow-hidden rounded-lg border p-1.5 transition-[background-color,border-color,box-shadow] duration-200 sm:min-h-[68px] sm:p-2 ${
                  isSelected
                    ? "border-cyan-300/55 bg-cyan-400/[0.085] shadow-[0_0_16px_rgba(34,211,238,0.09),inset_0_0_14px_rgba(34,211,238,0.035)]"
                    : "border-white/[0.055] bg-slate-900/45 hover:border-cyan-300/30 hover:bg-slate-800/65 hover:shadow-[0_5px_20px_-10px_rgba(34,211,238,0.22)]"
                }`}
              >
                {/* Selected-day LED edge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      key="selected-glow"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                      className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    />
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => onDateSelect(day.date)}
                  aria-label={`Selecionar ${formatLocalDate(day.date, {
                    day: "numeric",
                    month: "long",
                  })}`}
                  aria-pressed={isSelected}
                  className="flex w-full items-center justify-between gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <motion.span
                    whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className={`relative flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-200 ${
                      isToday
                        ? "bg-cyan-300 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                        : isSelected
                          ? "bg-cyan-300/[0.09] text-cyan-200"
                          : "text-slate-300 group-hover/day:text-white"
                    }`}
                  >
                    {isToday && !reduceMotion && (
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [0.25, 0.65, 0.25] }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="absolute inset-0 rounded-md ring-1 ring-cyan-200/80"
                      />
                    )}
                    {Number(day.date.slice(-2))}
                  </motion.span>

                  {day.plans.length > 0 && (
                    <span
                      className={`text-[10px] tabular-nums transition-colors ${
                        isSelected ? "text-cyan-100/80" : "text-slate-500"
                      }`}
                    >
                      {completed}/{day.plans.length}
                    </span>
                  )}
                </button>

                {/* Task indicators */}
                <div className="mt-1.5 flex min-h-1.5 flex-wrap items-center gap-1">
                  {day.plans.slice(0, 4).map((plan, index) => (
                    <motion.span
                      key={plan.id}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: reduceMotion ? 0 : index * 0.045,
                        type: "spring",
                        stiffness: 400,
                        damping: 20,
                      }}
                      title={plan.title}
                      className={`h-1.5 w-1.5 rounded-full transition-shadow duration-200 group-hover/day:shadow-[0_0_6px_currentColor] ${
                        plan.completedAt
                          ? "bg-emerald-400 text-emerald-400"
                          : "bg-cyan-400 text-cyan-400"
                      }`}
                    />
                  ))}

                  {day.plans.length > 4 && (
                    <span className="text-[9px] leading-none text-slate-500">
                      +{day.plans.length - 4}
                    </span>
                  )}

                  {pending > 0 && (
                    <span className="sr-only">
                      {pending} planos pendentes
                    </span>
                  )}
                </div>

                {/* Quick-create button */}
                <motion.button
                  type="button"
                  onClick={() => onPlanCreate(day.date)}
                  aria-label={`Criar plano para ${formatLocalDate(day.date, {
                    day: "numeric",
                    month: "long",
                  })}`}
                  title="Criar plano neste dia"
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 1.12,
                          rotate: 90,
                          transition: { duration: 0.18 },
                        }
                  }
                  whileTap={reduceMotion ? undefined : { scale: 0.85 }}
                  className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-md border border-transparent text-slate-500 opacity-100 transition-[color,background-color,border-color,box-shadow,opacity] duration-200 hover:border-cyan-300/20 hover:bg-cyan-300/10 hover:text-cyan-200 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:opacity-0 sm:group-hover/day:opacity-100"
                >
                  <Plus size={12} />
                </motion.button>

                {/* Glass reflection */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.055] to-transparent opacity-0 transition-opacity duration-300 group-hover/day:opacity-100"
                />
              </motion.div>
            );
          }),
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-2.5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.45)]" />
          Pendente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.35)]" />
          Concluído
        </span>

        <span className="ml-auto flex items-center gap-1 text-slate-500/90">
          <Plus size={10} className="text-cyan-400" />
          Clique para criar um plano
        </span>
      </div>
    </motion.section>
  );
}
