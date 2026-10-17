"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WeeklyPlanItem } from "@/types";
import { formatLocalDate, getMonthWeeks, SHORT_WEEKDAYS, todayIso } from "@/lib/planning/dates";
import { parseIsoKey } from "@/lib/planning/dates";
import { EventChip } from "./EventChip";
import { ChevronDown } from "lucide-react";

interface WeekViewProps {
  /** Mês selecionado na vista (agrupado em semanas pelo helper `getMonthWeeks`). */
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
  /** Mantidos para contratos externos (ex.: futuro chip de ações por dia). */
  onToggleCompleted?: (id: number, completed: boolean) => void;
  onDelete?: (id: number) => void;
}

interface WeekDay {
  date: string;
  dayName: string;
  dayNumber: number;
  plans: WeeklyPlanItem[];
  isToday: boolean;
  isSelected: boolean;
}

/** Índice do weekday (Seg=0 … Dom=6) a partir de uma chave YYYY-MM-DD. */
function weekdayIndex(iso: string): number {
  const { year, month, day } = parseIsoKey(iso);
  const d = new Date(year, month - 1, day);
  return (d.getDay() + 6) % 7; // segunda=0 … domingo=6
}

export function WeekView({ monthRange, plans, selectedDate, onDateSelect, onPlanCreate }: WeekViewProps) {
  const reduced = useReducedMotion();
  const today = todayIso();
  const year = parseInt(monthRange.start.slice(0, 4), 10);
  const month = parseInt(monthRange.start.slice(5, 7), 10);
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);

  const plansByDate = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem[]>();
    for (const p of plans) {
      const list = map.get(p.planDate) ?? [];
      list.push(p);
      map.set(p.planDate, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || (a.title || "").localeCompare(b.title || ""),
      );
    }
    return map;
  }, [plans]);

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const todayWeekIndex = weeks.find((w) => w.days.includes(today))?.index ?? weeks[0]?.index ?? 1;

  // Na montagem (e ao trocar de mês): a semana atual fica expandida e visível.
  useEffect(() => {
    const el = sectionRefs.current[todayWeekIndex];
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [monthRange.start, todayWeekIndex, reduced]);

  const toggleWeek = (index: number) => {
    setCollapsed((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const renderWeek = (weekIndex: number) => {
    const week = weeks[weekIndex - 1];
    if (!week) return null;
    const isCollapsed = Boolean(collapsed[week.index]);
    const isCurrentWeek = week.index === todayWeekIndex;
    const planCount = week.days.reduce((n, d) => n + (plansByDate.get(d)?.length ?? 0), 0);
    const rangeLabel = `${formatLocalDate(week.start, { day: "numeric" })} – ${formatLocalDate(week.end, { day: "numeric" })} de ${formatLocalDate(week.start, { month: "long" })}`;

    return (
      <motion.div
        key={week.index}
        ref={(el) => {
          sectionRefs.current[week.index] = el;
        }}
        className={`week-section relative flex min-h-0 flex-col rounded-xl border bg-[var(--bg-surface)] transition-[border-color,box-shadow] duration-150 ${
          isCollapsed ? "flex-none" : "flex-1"
        } ${isCurrentWeek ? "border-[var(--accent)]" : "border-[var(--border-subtle)]"}`}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
      >
        {/* Header da semana: rótulo, faixa de datas, contagem e chevron. */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-2">
          <h3 className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-[var(--text)]">
            Semana {week.index}
            {isCurrentWeek && (
              <span className="week-badge inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--bg-primary)]">
                Esta semana
              </span>
            )}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-[var(--text-faint)]">{rangeLabel}</span>
            <span className="text-[10px] text-[var(--text-faint)]" aria-hidden="true">
              •
            </span>
            <span className="text-[10px] text-[var(--text-faint)]">
              {planCount} {planCount === 1 ? "plano" : "planos"}
            </span>
            <button
              type="button"
              onClick={() => toggleWeek(week.index)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? `Expandir semana ${week.index}` : `Recolher semana ${week.index}`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
            >
              <ChevronDown size={14} className={`transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
            </button>
          </div>
        </div>

        {isCollapsed ? null : (
          <AnimatePresence initial={false}>
            <motion.div
              key="week-days"
              className="week-days min-h-0 flex-1 overflow-y-auto overscroll-contain"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
            >
              <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-7">
                {week.days.map((date) => (
                  <DayCard
                    key={date}
                    day={{
                      date,
                      dayName: SHORT_WEEKDAYS[weekdayIndex(date)],
                      dayNumber: parseInt(date.slice(8, 10), 10),
                      plans: plansByDate.get(date) ?? [],
                      isToday: date === today,
                      isSelected: date === selectedDate,
                    }}
                    onSelect={onDateSelect}
                    onPlanCreate={onPlanCreate}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    );
  };

  return (
    <div key={monthRange.start} className="week-view-stack flex h-[calc(100dvh_-_320px)] min-h-0 flex-col gap-4">
      {weeks.map((_, i) => renderWeek(i + 1))}
    </div>
  );
}

interface DayCardProps {
  day: WeekDay;
  onSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
}

function DayCard({ day, onSelect, onPlanCreate }: DayCardProps) {
  const sortedPlans = [...day.plans].sort(
    (a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || (a.title || "").localeCompare(b.title || ""),
  );

  return (
    <div
      className={`day-card group relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-[var(--bg-surface)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] ${
        day.isToday
          ? "border-[var(--accent)]"
          : day.isSelected
            ? "border-[var(--border-subtle)] shadow-[0_0_0_2px_var(--accent)]"
            : "border-[var(--border-subtle)]"
      }`}
      onClick={() => onSelect(day.date)}
      onDoubleClick={() => onPlanCreate(day.date)}
    >
      {/* Header: abreviação do weekday + número do dia (preenchido para hoje). */}
      <div className="flex shrink-0 items-center justify-between gap-1 px-1 pb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">{day.dayName}</span>
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
            day.isToday
              ? "bg-[var(--accent)] text-[var(--bg-primary)]"
              : day.isSelected
                ? "border border-[var(--accent)] text-[var(--accent)]"
                : "border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text)]"
          }`}
        >
          {day.dayNumber}
        </span>
      </div>

      {/* Planos do dia: chips compactos, uma linha, ellipsis, tooltip com o título. */}
      <div className="week-card-plans flex min-h-0 flex-col gap-1">
        {day.plans.length === 0 ? (
          <span className="px-1 pt-1 text-[11px] text-[var(--text-faint)]">Sem planos</span>
        ) : (
          sortedPlans.map((p) => (
            <EventChip key={p.id} plan={p} onClick={() => onSelect(day.date)} />
          ))
        )}
      </div>

      {/* Ação de criar plano do dia. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlanCreate(day.date);
        }}
        className="week-card-add mt-auto flex items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-1.5 text-[11px] font-medium text-[var(--text-faint)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        aria-label={`Adicionar plano para ${day.date}`}
      >
        + Adicionar
      </button>
    </div>
  );
}
