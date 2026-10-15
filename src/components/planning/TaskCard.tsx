"use client";

import type { WeeklyPlanItem } from "@/types";
import { Check, X } from "lucide-react";
import { IconButton } from "@/components/ui";

interface TaskCardProps {
  plan: WeeklyPlanItem;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  /** Sempre mostra os botões de ação (touch). No desktop eles aparecem no hover/foco. */
  alwaysVisible?: boolean;
}

export function TaskCard({ plan, onToggle, onDelete, alwaysVisible = false }: TaskCardProps) {
  const isCompleted = Boolean(plan.completedAt);
  const color = plan.color || plan.category.color;
  const title = plan.title || "(sem título)";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
        isCompleted
          ? "border-[var(--text-muted)]/40 bg-white/[0.02]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      } group`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="min-w-0 flex-1 gap-2 flex flex-col">
        <span
          className={`min-w-0 font-medium leading-tight ${isCompleted ? "line-through opacity-60" : "text-[var(--text)]"}`}
          title={title}
          style={{ display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {title}
        </span>
        {plan.startTime && (
          <span className="text-[11px] text-[var(--text-faint)] leading-none">{plan.startTime}</span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={isCompleted ? "Desmarcar plano" : "Concluir plano"}
          className={`
            rounded-full border transition-opacity duration-200
            ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100"}
            ${isCompleted
              ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/20"
              : "border-[var(--text-muted)]/30 text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"}
          `}
          onClick={() => onToggle(!isCompleted)}
        >
          <Check size={14} strokeWidth={isCompleted ? 3 : 2} />
        </IconButton>

        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Excluir plano"
          className={`
            rounded-full transition-opacity duration-200
            ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100"}
            text-[var(--text-faint)] hover:text-[var(--red)] hover:bg-[var(--red-bg)]
          `}
          onClick={onDelete}
        >
          <X size={14} />
        </IconButton>
      </div>
    </div>
  );
}
