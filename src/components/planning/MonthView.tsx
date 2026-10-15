"use client";

import type { WeeklyPlanItem } from "@/types";
import { addDays, daysInMonth, isoKey, todayIso } from "@/lib/planning/dates";
import { SHORT_WEEKDAYS } from "@/lib/planning/dates";

interface MonthViewProps {
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

// Altura mínima da linha da grade no desktop (~96–120px, dividida pelo número
// de semanas necessárias dentro do limite máximo da viewport).
const CELL_MIN_HEIGHT = 88;

export function MonthView({ monthRange, plans, selectedDate, onDateSelect }: MonthViewProps) {
  const today = todayIso();
  const year = parseInt(monthRange.start.slice(0, 4), 10);
  const month = parseInt(monthRange.start.slice(5, 7), 10);
  const monthKey = monthRange.start.slice(0, 7);

  const total = daysInMonth(monthRange.start);
  const firstOfMonth = new Date(year, month - 1, 1);
  const lead = (firstOfMonth.getDay() + 6) % 7; // segunda=0 … domingo=6

  const days: string[] = [];
  for (let i = 0; i < lead; i++) days.push(addDays(isoKey(year, month, 1), i - lead));
  for (let i = 1; i <= total; i++) days.push(isoKey(year, month, i));
  // Completa apenas a última semana (4, 5 ou 6 linhas no total).
  const tail = (-days.length) % 7;
  for (let i = 1; i <= tail; i++) days.push(addDays(monthRange.end, i));
  const rowCount = days.length / 7;

  const plansByDate = new Map<string, WeeklyPlanItem[]>();
  for (const p of plans) {
    const list = plansByDate.get(p.planDate) ?? [];
    list.push(p);
    plansByDate.set(p.planDate, list);
  }

  const isToday = (d: string) => d === today;
  const isSelected = (d: string) => d === selectedDate;
  const isCurrentMonth = (d: string) => d.slice(0, 7) === monthKey;

  const chipTitle = (p: WeeklyPlanItem) => (p.title || "(sem título)").slice(0, 18);

  return (
    <div className="space-y-2">
      <div
        className="grid grid-cols-7 gap-[1px] border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)]"
        style={{
          gridTemplateRows: `repeat(${rowCount}, minmax(${CELL_MIN_HEIGHT}px, 1fr))`,
        }}
      >
        {SHORT_WEEKDAYS.map((name) => (
          <div key={name} className="flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] px-2 py-2">
            {name}
          </div>
        ))}
        {days.map((date) => {
          const dayPlans = (plansByDate.get(date) ?? []).slice().sort((a, b) => (a.title || "").localeCompare(b.title || ""));
          const cur = isCurrentMonth(date);
          const sel = isSelected(date);
          const td = isToday(date);
          const dayNumber = parseInt(date.slice(8, 10), 10);

          return (
            <button
              key={date}
              type="button"
              onClick={() => onDateSelect(date)}
              aria-label={cur ? `Dia ${dayNumber} de ${month}` : undefined}
              className={`
                flex flex-col p-2 text-left transition-colors
                border-b border-r last:border-b-0 last:border-r-0
                ${!cur ? "opacity-50" : ""}
                ${sel
                  ? "bg-[var(--accent)] text-white"
                  : "bg-transparent hover:bg-[var(--bg-surface-hover)] active:bg-[var(--bg-surface-active)]"}
                ${td && !sel ? "ring-2 ring-inset ring-[var(--accent)]" : ""}
                focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2
              `}
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex justify-between items-start gap-1 pb-1">
                <span
                  className={`text-[11px] font-bold leading-none ${
                    sel ? "text-white" : cur ? "text-[var(--text)]" : "text-[var(--text-faint)]"
                  }`}
                >
                  {dayNumber}
                </span>
                {td && !sel && (
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                {dayPlans.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    title={p.title}
                    className={`inline-block max-w-[none] truncate rounded px-1.5 py-0.5 text-[9px] leading-none ${
                      p.completedAt ? "opacity-60 line-through" : ""
                    } border border-current/30 ${
                      p.completedAt ? "text-[var(--text-faint)]" : `text-[${p.color || p.category.color}] bg-[${p.color || p.category.color}]/10`
                    }`}
                  >
                    {chipTitle(p)}
                  </span>
                ))}
                {dayPlans.length > 3 && (
                  <span className="text-[9px] font-bold leading-none text-[var(--text-faint)]">
                    +{dayPlans.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
