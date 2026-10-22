"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, Check, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import type { WeeklyPlanItem } from "@/types";
import { eventColor, shortTimeLabel } from "@/lib/planning/categories";

export function planItemKey(plan: WeeklyPlanItem): string {
  return plan.seriesId !== null
    ? `series:${plan.seriesId}:${plan.planDate}`
    : `plan:${plan.id}`;
}

interface PlanRowProps {
  plan: WeeklyPlanItem;
  compact?: boolean;
  fullTitle?: boolean;
  animateCompletion?: boolean;
  onToggleCompleted: (plan: WeeklyPlanItem, completed: boolean) => void;
  onEdit: (plan: WeeklyPlanItem) => void;
  onDelete: (plan: WeeklyPlanItem) => void;
}

export function PlanRow({ plan, compact = false, fullTitle = false, animateCompletion = false, onToggleCompleted, onEdit, onDelete }: PlanRowProps) {
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const completed = Boolean(plan.completedAt);
  const color = eventColor(plan);
  const time = shortTimeLabel(plan);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const checkbox = (
    <motion.button
      type="button"
      onClick={() => onToggleCompleted(plan, !completed)}
      whileTap={!reduced ? { scale: 0.88 } : undefined}
      aria-label={`${completed ? "Reabrir" : "Concluir"} ${plan.title || "plano"}`}
      aria-pressed={completed}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        completed
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-primary)]"
          : "border-[var(--border-strong)] text-transparent hover:border-[var(--accent)]"
      }`}
    >
      {completed ? (animateCompletion ? <motion.span initial={reduced ? false : { scale: 0, rotate: -28 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 520, damping: 18 }}><Check size={12} aria-hidden="true" /></motion.span> : <Check size={12} aria-hidden="true" />) : null}
    </motion.button>
  );

  const titleButton = (
    <button
      type="button"
      onClick={() => onEdit(plan)}
      className={`min-w-0 flex-1 text-left text-xs font-medium focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${fullTitle ? "whitespace-normal break-words" : "truncate"} ${
        completed ? "text-[var(--text-faint)] line-through" : "text-[var(--text)]"
      }`}
      title={plan.title || "(sem título)"}
    >
      {plan.title || "(sem título)"}
    </button>
  );

  const repeatIcon = plan.isRecurring ? (
    <Repeat size={11} className="shrink-0 text-[var(--text-faint)]" aria-label="Plano recorrente" />
  ) : null;

  const bellIcon = plan.reminderOffsetMin !== null ? (
    <Bell size={12} className="shrink-0 text-[var(--accent)]" aria-label="Plano com lembrete" />
  ) : null;

  const actions = (
    <div ref={menuRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={`Ações para ${plan.title || "plano"}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`grid place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          compact ? "h-6 w-6" : "h-7 w-7"
        }`}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          aria-label={`Ações para ${plan.title || "plano"}`}
          className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onEdit(plan);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <Pencil size={13} aria-hidden="true" /> Editar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete(plan);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[var(--red)] hover:bg-[var(--red)]/10 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <Trash2 size={13} aria-hidden="true" /> Excluir
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={`group/plan min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] ${
        compact ? "flex flex-col gap-0.5 px-2 py-1.5" : "flex items-center gap-2 px-2.5 py-2"
      }`}
      // Na coluna estreita da Semana a cor da categoria vira a borda esquerda:
      // o título fica com a largura toda da linha.
      style={compact ? { borderLeftColor: color, borderLeftWidth: 2 } : undefined}
      data-testid={`plan-${planItemKey(plan)}`}
    >
      {compact ? (
        <>
          <div className="flex min-w-0 items-center gap-1.5">
            {checkbox}
            {repeatIcon}
            {titleButton}
            {bellIcon}
            {actions}
          </div>
          {time ? (
            <span className="truncate pl-6 text-[10px] leading-tight tabular-nums text-[var(--text-faint)]">{time}</span>
          ) : null}
        </>
      ) : (
        <>
          {checkbox}
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
          {repeatIcon}
          {titleButton}
          {time ? <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-faint)]">{time}</span> : null}
          {bellIcon}
          {actions}
        </>
      )}
    </div>
  );
}
