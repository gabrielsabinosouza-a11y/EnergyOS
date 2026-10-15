"use client";

import type { WeeklyPlanItem } from "@/types";
import { Check, X } from "lucide-react";
import { IconButton } from "@/components/ui";

interface TaskCardProps {
  plan: WeeklyPlanItem;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  /** Quando true, mostra os ícones de conclusão/exclusão sempre (touch/não-hover). */
  alwaysShowActions?: boolean;
  compact?: boolean;
}

export function TaskCard({ plan, onToggle, onDelete, alwaysShowActions = false, compact = false }: TaskCardProps) {
  const isCompleted = Boolean(plan.completedAt);
  const color = plan.color || plan.category.color;
  const size = compact ? 14 : 16;

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors ${
        isCompleted
          ? "border-[var(--text-muted)]/40 bg-white/[0.02]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      }`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <span
          className={`font-medium leading-tight ${isCompleted ? "line-through opacity-60" : "text-[var(--text)]"}`}
          title={plan.title}
        >
          {plan.title || "(sem título)"}
        </span>
        {plan.startTime && (
          <span className="text-[11px] text-[var(--text-faint)] leading-none">{plan.startTime}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <IconButton
          size={compact ? "sm" : "md"}
          variant="ghost"
          aria-label={isCompleted ? "Desmarcar plano" : "Concluir plano"}
          className={`
            border rounded-full ${alwaysShowActions || compact ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}
            transition-opacity duration-200
            ${isCompleted
              ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/20"
              : "border-[var(--text-muted)]/30 text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"}
          `}
          onClick={() => onToggle(!isCompleted)}
          disabled={isCompleted ? undefined : undefined}
        >
          <Check size={size} strokeWidth={isCompleted ? 3 : 2} />
        </IconButton>

        <IconButton
          size={compact ? "sm" : "md"}
          variant="ghost"
          aria-label="Excluir plano"
          className={`
            rounded-full ${alwaysShowActions || compact ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}
            transition-opacity duration-200
            text-[var(--text-faint)] hover:text-[var(--red)] hover:bg-[var(--red-bg)]
          `}
          onClick={onDelete}
        >
          <X size={size} />
        </IconButton>
      </div>
    </div>
  );
}
