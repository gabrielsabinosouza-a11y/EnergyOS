"use client";

import { useMemo } from "react";
import { todayIso, formatLocalDate } from "@/lib/planning/dates";
import type { WeeklyPlanItem } from "@/types";
import { PlannerTimeGrid, type TimeGridDay } from "./PlannerTimeGrid";
import { Plus, Pencil } from "lucide-react";

interface DayViewProps {
  date: string;
  plans: WeeklyPlanItem[];
  onToggleCompleted?: (id: number, completed: boolean) => void;
  onDelete?: (id: number) => void;
  onPlanCreate: (date: string, minutes?: number) => void;
  shortcutHint?: string;
}

export function DayView({ date, plans, onPlanCreate }: DayViewProps) {
  const today = todayIso();
  const isToday = date === today;
  const weekday = formatLocalDate(date, { weekday: "long" });
  const dateLabel = formatLocalDate(date, { day: "numeric", month: "short", year: "numeric" });

  const sorted = useMemo(
    () => [...plans].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
    [plans],
  );

  const isEmpty = sorted.length === 0;

  // ── Estado vazio: card centralizado com CTA de criar plano (tarefa 1) ──
  if (isEmpty) {
    const dateLabelLower = dateLabel.toLowerCase();
    return (
      <div className="flex h-full min-h-0 flex-col">
        <button
          type="button"
          onClick={() => onPlanCreate(date)}
          className="day-empty-state group relative flex h-full w-full flex-col items-center justify-center text-center"
          aria-label={`Adicionar plano para ${weekday}, ${dateLabelLower}`}
        >
          {/* Ícone: círculo nítido, sem halo blur — glow suave e pequeno. */}
          <span
            aria-hidden="true"
            className="day-empty-icon flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border-subtle)] transition-transform duration-200"
          >
            <Plus size={26} className="text-[var(--accent)]" aria-hidden="true" />
          </span>
          <p className="mt-4 text-[var(--text)] text-base font-semibold">Nenhum plano para este dia</p>
          <p className="mt-2 text-[var(--text-secondary)] text-sm">Clique para criar seu primeiro plano</p>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onPlanCreate(date);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPlanCreate(date);
              }
            }}
            className="day-empty-cta mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-base font-bold text-[var(--bg-primary)] shadow-[0_0_16px_var(--accent-glow)] transition-shadow duration-200 group-hover:shadow-[0_0_24px_var(--accent-glow)]"
          >
            Adicionar plano
          </span>
        </button>
      </div>
    );
  }

  // ── Dia com planos: timeline + painel lateral ───────────────────────────
  const nextEvent = useMemo(
    () =>
      plans
        .filter((p) => !p.completedAt && p.startTime)
        .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))[0] ?? null,
    [plans],
  );

  const gridDays: TimeGridDay[] = useMemo(
    () => [
      {
        date,
        today: isToday,
        selected: false,
        events: sorted.filter((p) => Boolean(p.startTime)),
      },
    ],
    [date, isToday, sorted],
  );

  const eventCount = sorted.length;
  const completedCount = sorted.filter((p) => Boolean(p.completedAt)).length;

  return (
    <div className="flex h-full min-h-0 flex-1">
      {/* Timeline full-width. */}
      <PlannerTimeGrid days={gridDays} onSlotClick={(d, minutes) => onPlanCreate(d, minutes)} onEventClick={() => {}} />

      {/* Painel lateral com o resumo do dia (desktop). */}
      <aside className="hidden w-[340px] shrink-0 border-l border-[var(--border-subtle)] lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="glass-card flex h-full flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="eyebrow">{weekday}</p>
                <h2 className={`mt-1 text-xl font-bold ${isToday ? "text-[var(--accent)]" : ""}`}>{dateLabel}</h2>
              </div>
              <button
                type="button"
                onClick={() => onPlanCreate(date)}
                aria-label="Adicionar plano"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent)] transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Eventos</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{eventCount}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Concluídos</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--green)]">{completedCount}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Próximo evento</p>
              {nextEvent ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="mv-chip__dot shrink-0" style={{ backgroundColor: nextEvent.color || nextEvent.category.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text)]">{nextEvent.title || "(sem título)"}</p>
                    <p className="text-[11px] tabular-nums text-[var(--text-faint)]">
                      {nextEvent.startTime} · {nextEvent.durationMinutes ?? ""}min
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--text-faint)]">Nenhum plano hoje.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onPlanCreate(date)}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-bg)] px-4 py-2.5 text-[13px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-bg)]/80"
            >
              <Pencil size={14} /> Novo evento
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
