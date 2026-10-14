"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysIso } from "@/lib/db/dates";
import type { WeeklyPlanItem } from "@/types";

interface CalendarToolbarProps {
  selectedDate: string;
  view: "month" | "week" | "day";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange?: (view: "month" | "week" | "day") => void;
}

export function CalendarToolbar({ selectedDate, view, onPrev, onNext, onToday }: CalendarToolbarProps) {
  const viewLabels = { month: "Mês", week: "Semana", day: "Dia" };
  const [y, m, d] = selectedDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const formatDateRange = () => {
    if (view === "month") return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (view === "week") {
      const dayOfWeek = date.getDay() || 7;
      const weekStart = addDaysIso(selectedDate, -(dayOfWeek - 1));
      const weekEnd = addDaysIso(weekStart, 6);
      const [, , sd] = weekStart.split("-");
      const [, , ed] = weekEnd.split("-");
      return `${parseInt(sd!)} - ${parseInt(ed!)} de ${date.toLocaleDateString("pt-BR", { month: "long" })}`;
    }
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={20} className="text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Planejamento</h1>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          <button onClick={onPrev} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors" aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={onToday} className="px-3 py-1 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--accent-bg)] rounded-md transition-colors" aria-label="Hoje">
            Hoje
          </button>
          <button onClick={onNext} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors" aria-label="Próximo">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="text-sm font-medium text-[var(--text-secondary)]">{formatDateRange()}</div>
      </div>
    </div>
  );
}
