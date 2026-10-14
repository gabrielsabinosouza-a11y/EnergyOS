"use client";

import { addDaysIso, weekStartIso } from "@/lib/db/dates";
import type { WeeklyPlanItem, Category } from "@/types";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface MonthViewProps {
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string, title: string, categoryId: number) => void;
}

export function CalendarMonthView({ monthRange, plans, selectedDate, onDateSelect, onPlanCreate }: MonthViewProps) {
  const year = parseInt(monthRange.start.slice(0, 4));
  const month = parseInt(monthRange.start.slice(5, 7));
  
  // Get the first day of the month (Monday-based week)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstDayWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // Monday = 0
  
  // Generate calendar days
  const days: string[] = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  
  // Add leading days from previous month
  for (let i = 0; i < firstDayWeekday; i++) {
    days.push(addDaysIso(monthRange.start, i - firstDayWeekday).slice(0, 10));
  }
  
  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(`${monthRange.start.slice(0, 7)}-${String(i).padStart(2, "0")}`);
  }
  
  // Add trailing days to complete the grid
  const totalDays = days.length;
  const remainingDays = Math.ceil(totalDays / 7) * 7 - totalDays;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(addDaysIso(monthRange.end, i));
  }

  const plansByDate = plans.reduce((acc, plan) => {
    if (!acc.has(plan.planDate)) acc.set(plan.planDate, []);
    acc.get(plan.planDate)!.push(plan);
    return acc;
  }, new Map<string, WeeklyPlanItem[]>());

  const isToday = (date: string) => date === weekStartIso(selectedDate).slice(0, 10) ? "today" : "";
  const isSelected = (date: string) => date === selectedDate ? "selected" : "";

  return (
    <div className="space-y-2">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px text-center">
        {DAY_NAMES.map((day) => (
          <div key={day} className="text-[11px] font-medium text-[var(--text-faint)] uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((date) => {
          const dayPlans = plansByDate.get(date) || [];
          const dateObj = new Date(date + "T00:00:00Z");
          const isCurrentMonth = date.startsWith(monthRange.start.slice(0, 7));
          const dayPlansCount = dayPlans.length;
          
          return (
            <button
              key={date}
              onClick={() => onDateSelect(date)}
              className={`aspect-square p-2 text-left rounded-md transition-all hover:bg-[var(--bg-surface-hover)] ${
                isCurrentMonth ? "bg-[var(--bg-surface)]" : "bg-[var(--bg-secondary)]/30"
              } ${isSelected(date)} ${isToday(date) ? "border-2 border-[var(--accent)]" : "border border-transparent"}`}
            >
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                {dateObj.getUTCDate()}
              </div>
              <div className="text-[10px] leading-none">
                {dayPlansCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    {dayPlans.slice(0, 2).map((p) => (
                      <span 
                        key={p.id}
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: p.color || p.category.color }}
                      />
                    ))}
                    {dayPlansCount > 2 && (
                      <span className="text-[var(--accent)] font-bold">+{dayPlansCount - 2}</span>
                    )}
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
