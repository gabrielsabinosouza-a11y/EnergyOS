"use client";

import type { WeeklyPlanItem, Category } from "@/types";
import { addDays, daysInMonth, isoKey, parseIsoKey, todayIso, weekStart } from "@/lib/planning/dates";
import { SHORT_WEEKDAYS } from "@/lib/planning/dates";
import { TaskCard } from "@/components/planning/TaskCard";

interface MonthViewProps {
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string) => void;
}

const ROWS = 6;
const CELL_ROW = `minmax(clamp(88px, 13vh, 110px), auto)`;

export function MonthView({ monthRange, plans, selectedDate, onDateSelect, onPlanCreate }: MonthViewProps) {
  const today = todayIso();
  const year = parseInt(monthRange.start.slice(0, 4), 10);
  const month = parseInt(monthRange.start.slice(5, 7), 10);

  const total = daysInMonth(monthRange.start);
  const firstOfMonth = new Date(year, month - 1, 1);
  const lead = (firstOfMonth.getDay() + 6) % 7; // segunda=0

  const days: string[] = [];
  for (let i = 0; i < lead; i++) days.push(addDays(isoKey(year, month, 1), i - lead));
  for (let i = 1; i <= total; i++) days.push(isoKey(year, month, i));
  const tail = ROWS * 7 - days.length;
  for (let i = 1; i <= tail; i++) days.push(addDays(monthRange.end, i));

  const plansByDate = new Map<string, WeeklyPlanItem[]>();
  for (const p of plans) {
    const list = plansByDate.get(p.planDate) ?? [];
    list.push(p);
    plansByDate.set(p.planDate, list);
  }

  const isToday = (d: string) => d === today;
  const isSelected = (d: string) => d === selectedDate;
  const isCurrentMonth = (d: string) => d.slice(0, 7) === monthRange.start.slice(0, 7);

  const chipTitle = (p: WeeklyPlanItem) => (p.title || "(sem título)").slice(0, 18);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-[1px] border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)]">
        {SHORT_WEEKDAYS.map((name) => (
          <div key={name} className="flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            {name}
          </div>
        ))}
        {days.map((date) => {
            const dayPlans = (plansByDate.get(date) ?? []).slice();
            dayPlans.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
            const cur = isCurrentMonth(date);
            const sel = isSelected(date);
            const td = isToday(date);

            return (
              <button
                key={date}
                type="button"
                onClick={() => onDateSelect(date)}
                aria-label={cur ? `Dia ${parseInt(date.slice(8, 10), 10)} de ${monthRange.start.slice(5, 7)}` : undefined}
                className={`
                  flex flex-col p-1.5 text-left transition-all
                  border-b border-r last:rounded-b-r-lg
                  ${!cur ? "opacity-50" : ""}
                  ${sel ? "bg-[var(--accent)] text-white" : "bg-transparent hover:bg-[var(--bg-surface-hover)]"}
                  ${td ? "ring-2 ring-inset ring-[var(--accent)]" : "border-transparent focus-visible:outline-none"}
                `}
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span
                  className={`text-[11px] font-bold leading-none ml-0.5 mb-0.5 ${
                    sel ? "text-white" : cur ? "text-[var(--text)]" : "text-[var(--text-faint)]"
                  }`}
                >
                  {parseInt(date.slice(8, 10), 10)}
                </span>

                <div className="flex-1 flex flex-col gap-0.5">
                  {dayPlans.slice(0, 2).map((p) => (
                    <span
                      key={p.id}
                      title={p.title}
                      className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[9px] leading-tight ${
                        p.completedAt ? "opacity-60 line-through" : ""
                      } border border-current/30 ${
                        p.completedAt ? "text-[var(--text-faint)]" : `text-[${p.color || p.category.color}] bg-[${p.color || p.category.color}]/10`
                      }`}
                    >
                      {chipTitle(p)}
                    </span>
                  ))}
                  {dayPlans.length > 2 && (
                    <span className="text-[9px] font-bold leading-none text-[var(--text-faint)]">
                      +{dayPlans.length - 2}
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
