"use client";

import { Check, Plus } from "lucide-react";
import type { WeeklyPlanItem, Category } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_ITEMS_PER_CARD = 4;

interface CalendarWeekViewProps {
  weekRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string, title: string, categoryId: number) => void;
  onUpdate: (id: number, title: string, categoryId: number, planDate: string) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onToggleOccurrence: (seriesId: number, date: string, completed: boolean) => void;
  onUpdateOccurrenceOverride: (seriesId: number, date: string, title: string, startTime: string | null) => void;
  categories: Category[];
}

export function CalendarWeekView({ 
  weekRange, plans, selectedDate, onDateSelect, onPlanCreate, onUpdate, 
  onToggleCompleted, onDelete, onToggleOccurrence, onUpdateOccurrenceOverride, categories 
}: CalendarWeekViewProps) {
  const today = todayIso();
  
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekRange.start, i);
    const dayPlans = plans.filter((p) => p.planDate === date);
    const sortedPlans = [...dayPlans].sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });
    return { 
      date, 
      dayName: DAY_NAMES[i], 
      plans: sortedPlans, 
      isToday: date === today,
      isSelected: date === selectedDate
    };
  });

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-3 sm:gap-4">
        {days.map((day) => (
          <DayColumn
            key={day.date}
            day={day}
            categories={categories}
            onDateSelect={onDateSelect}
            onPlanCreate={onPlanCreate}
            onUpdate={onUpdate}
            onToggleCompleted={onToggleCompleted}
            onDelete={onDelete}
            onToggleOccurrence={onToggleOccurrence}
            onUpdateOccurrenceOverride={onUpdateOccurrenceOverride}
          />
        ))}
      </div>
    </div>
  );
}

interface DayColumnProps {
  day: { date: string; dayName: string; plans: WeeklyPlanItem[]; isToday: boolean; isSelected: boolean };
  categories: Category[];
  onDateSelect: (date: string) => void;
  onPlanCreate: (date: string, title: string, categoryId: number) => void;
  onUpdate: (id: number, title: string, categoryId: number, planDate: string) => void;
  onToggleCompleted: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onToggleOccurrence: (seriesId: number, date: string, completed: boolean) => void;
  onUpdateOccurrenceOverride: (seriesId: number, date: string, title: string, startTime: string | null) => void;
}

function DayColumn({ 
  day, categories, onDateSelect, onPlanCreate, onUpdate, onToggleCompleted, onDelete, 
  onToggleOccurrence, onUpdateOccurrenceOverride 
}: DayColumnProps) {
  const displayColor = (plan: WeeklyPlanItem) => plan.color || plan.category.color;

  return (
    <div className="flex flex-col min-h-[200px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] p-2 bg-[var(--bg-primary)]/30">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">{day.dayName}</span>
          <span className="text-[16px] font-mono tabular-nums text-[var(--text)]">{day.date.slice(8, 10)}</span>
        </div>
      </div>
      
      <div className="flex-1 p-2.5 space-y-1.5 overflow-y-auto">
        {day.plans.length === 0 && (
          <div className="flex h-full items-center justify-center text-center py-4">
            <span className="text-[12px] text-[var(--text-faint)]">Sem planos</span>
          </div>
        )}
        
        {day.plans.slice(0, MAX_ITEMS_PER_CARD).map((plan) => (
          <PlanChip
            key={plan.id}
            plan={plan}
            displayColor={displayColor(plan)}
            onToggle={() => onToggleCompleted(plan.id, !plan.completedAt)}
            onDelete={() => onDelete(plan.id)}
          />
        ))}
        
        {day.plans.length > MAX_ITEMS_PER_CARD && (
          <button 
            type="button"
            className="text-[13px] text-center font-medium text-[var(--accent)] hover:underline pt-1"
            aria-label={`Ver mais ${day.plans.length - MAX_ITEMS_PER_CARD} planos`}
          >
            +{day.plans.length - MAX_ITEMS_PER_CARD} mais
          </button>
        )}
      </div>
      
      <button
        type="button"
        onClick={() => onPlanCreate(day.date, "", 0)}
        className="mt-auto w-full text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-bg)] py-2 border-t border-[var(--border-subtle)]"
        aria-label="Adicionar plano"
      >
        <Plus size={14} className="inline mr-1" /> Adicionar
      </button>
    </div>
  );
}

interface PlanChipProps {
  plan: WeeklyPlanItem;
  displayColor: string;
  onToggle: () => void;
  onDelete: () => void;
}

function PlanChip({ plan, displayColor, onToggle, onDelete }: PlanChipProps) {
  const isCompleted = Boolean(plan.completedAt);
  const skipped = Boolean(plan.skipped);
  const containerOpacity = skipped ? 0.6 : isCompleted ? 0.55 : 1;
  const textOpacity = skipped ? 0.6 : isCompleted ? 0.55 : 1;
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className="group relative flex items-center justify-between gap-2 rounded-lg p-2 text-[14px] transition-all"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderLeft: `3px solid ${displayColor}`,
        opacity: containerOpacity,
      }}
    >
      <div className="flex min-w-0 flex-1">
        <span className="font-medium line-clamp-2" style={{ opacity: textOpacity }}>
          {plan.title || "(sem título)"}
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-label={isCompleted ? "Desmarcar plano" : "Concluir plano"}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
          style={{
            backgroundColor: isCompleted ? displayColor : "rgba(255, 255, 255, 0.05)",
            border: `2px solid ${isCompleted ? displayColor : "var(--text-muted)"}`,
            color: isCompleted ? "white" : "var(--text-muted)",
          }}
        >
          <Check size={16} strokeWidth={isCompleted ? 3 : 2} />
        </button>
        
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Excluir plano"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-all text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}