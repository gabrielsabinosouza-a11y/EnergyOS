"use client";

import type { WeeklyPlanItem } from "@/types";
import { todayIso } from "@/lib/planning/dates";
import { TaskCard } from "@/components/planning/TaskCard";
import { Pencil } from "lucide-react";

interface DayViewProps {
  date: string;
  plans: WeeklyPlanItem[];
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onPlanCreate: (date: string) => void;
}

export function DayView({ date, plans, onToggleCompleted, onDelete, onPlanCreate }: DayViewProps) {
  const today = todayIso();
  const isToday = date === today;
  const dateObj = new Date(date);
  const sorted = [...plans].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${isToday ? "text-[var(--accent)]" : ""}`}>
            {dateObj.toLocaleDateString("pt-BR", { weekday: "long" })}
          </h2>
          <p className={`text-[var(--text-faint)] text-sm ${isToday ? "font-medium" : ""}`}>
            {dateObj.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
            {isToday ? " · hoje" : ""}
          </p>
        </div>
        {isToday && (
          <button
            type="button"
            onClick={() => onPlanCreate(date)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            aria-label="Adicionar plano"
          >
            <Pencil size={16} /> Adicionar plano
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
          <div className="w-12 h-12 mb-3 rounded-full bg-[var(--accent-bg)] flex items-center justify-center">
            <Pencil size={20} className="text-[var(--accent)]" />
          </div>
          <p className="text-[var(--text-faint)] font-medium mb-2">Nenhum plano para este dia</p>
          <p className="text-[var(--text-faint)] text-sm">Comece criando um novo plano</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((plan) => {
            return (
              <div key={plan.id} className="group relative">
                <TaskCard
                  plan={plan}
                  onToggle={(completed) => onToggleCompleted(plan.id, completed)}
                  onDelete={() => onDelete(plan.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
