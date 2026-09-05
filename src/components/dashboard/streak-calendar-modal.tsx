"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Modal } from "@/components/modal";
import { api } from "@/lib/api-client";
import { StreakIcon, ShieldIcon } from "@/components/streak-icon";
import type { StreakDayStatus } from "@/types";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

interface StreakCalendarModalProps {
  open: boolean;
  streak: number;
  shieldCount: number;
  onClose: () => void;
}

export function StreakCalendarModal({
  open,
  streak,
  shieldCount,
  onClose,
}: StreakCalendarModalProps) {
  const reduced = useReducedMotion();
  const now = new Date();
  const [cursorYear, setCursorYear] = useState(now.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(now.getMonth());
  const [days, setDays] = useState<Record<string, StreakDayStatus>>({});
  const glowColor = "#ffb86b";

  const todayIsoStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .getStreakCalendar(cursorYear, cursorMonth)
      .then((res) => {
        if (!cancelled) setDays(res.days);
      })
      .catch(() => {
        if (!cancelled) setDays({});
      });
    return () => {
      cancelled = true;
    };
  }, [open, cursorYear, cursorMonth]);

  const changeMonth = (delta: number) => {
    setCursorMonth((m) => {
      const next = m + delta;
      if (next < 0) {
        setCursorYear((y) => y - 1);
        return 11;
      }
      if (next > 11) {
        setCursorYear((y) => y + 1);
        return 0;
      }
      return next;
    });
  };

  const monthLabel = new Date(cursorYear, cursorMonth, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Grid: first weekday (dom-base) offset + days in month.
  const firstWeekday = new Date(cursorYear, cursorMonth, 1).getDay();
  const daysInMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const dayStatus = (day: number, dateStr: string): { kind: StreakDayStatus | "future" | "none" } => {
    if (dateStr > todayIsoStr) return { kind: "future" };
    const s = days[dateStr];
    if (s) return { kind: s };
    return { kind: "none" };
  };

  const isTodayDate = (dateStr: string) => dateStr === todayIsoStr;

  return (
    <Modal open={open} onClose={onClose} panelClassName="max-w-md w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 26 }}
      >
        <div
          className="glass-card relative w-full overflow-hidden p-6"
          style={{ border: `1px solid ${glowColor}30` }}
        >
          {/* brilho ambiente */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/2 h-44 w-80 -translate-x-1/2 rounded-full opacity-40"
            style={{ background: `radial-gradient(ellipse, ${glowColor}55, transparent 70%)`, filter: "blur(22px)" }}
          />
          {/* borda LED superior */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${glowColor}99, transparent)`, boxShadow: `0 0 10px ${glowColor}66` }}
          />

          <div className="relative mb-4 flex items-center justify-between">
            <span className="eyebrow" style={{ color: glowColor }}>SEQUÊNCIA</span>
            <button onClick={onClose} className="icon-button small" aria-label="Fechar"><X size={14} /></button>
          </div>

          {/* Resumo no topo */}
          <div className="relative mb-5 flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/60 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${glowColor}1a`, boxShadow: `0 0 20px -4px ${glowColor}90` }}
            >
              <StreakIcon size={26} variant="saved" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold leading-none text-[var(--text)]">
                {streak} <span className="text-sm font-medium text-[var(--text-muted)]">dia{streak === 1 ? "" : "s"} de sequência!</span>
              </p>
              {shieldCount > 0 && (
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Você tem {shieldCount} escudo{shieldCount === 1 ? "" : "s"} disponíve{shieldCount === 1 ? "l" : "is"}
                </p>
              )}
            </div>
          </div>

          {/* Navegação por mês */}
          <div className="relative mb-3 flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              className="icon-button small"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold capitalize text-[var(--text)]">{monthLabel}</span>
            <button
              onClick={() => changeMonth(1)}
              className="icon-button small"
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Cabeçalho dos dias da semana */}
          <div className="relative mb-1 grid grid-cols-7 text-center">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                {w}
              </span>
            ))}
          </div>

          {/* Grid do calendário */}
          <div className="relative grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const dateStr = `${cursorYear}-${String(cursorMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const { kind } = dayStatus(day, dateStr);
              const isToday = isTodayDate(dateStr);

              return (
                <div
                  key={dateStr}
                  className={`relative flex aspect-square items-center justify-center rounded-lg text-xs ${
                    isToday ? "ring-1 ring-[var(--accent)]" : ""
                  }`}
                  style={
                    isToday
                      ? { boxShadow: `0 0 10px -2px ${glowColor}60` }
                      : undefined
                  }
                  title={`${day}/${cursorMonth + 1}${kind === "success" ? " — foco completo" : kind === "protected" ? " — protegido por escudo" : ""}`}
                >
                  {(kind === "success") && (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ background: `${glowColor}1f`, boxShadow: `0 0 12px ${glowColor}45` }}
                    >
                      <StreakIcon size={16} variant="saved" />
                    </span>
                  )}
                  {kind === "protected" && (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      title="Protegido por escudo"
                      style={{ background: "#71d4ff1f", boxShadow: `0 0 12px #71d4ff50` }}
                    >
                      <ShieldIcon size={16} />
                    </span>
                  )}
                  {kind === "none" && (
                    <span className="block h-1 w-1 rounded-full bg-[var(--text-faint)]/50" />
                  )}
                  {kind === "future" && (
                    <span className="text-[var(--text-faint)]/40">{day}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="relative mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3 text-[10px] text-[var(--text-faint)]">
            <span className="flex items-center gap-1.5">
              <StreakIcon size={13} variant="saved" /> Foco completo
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldIcon size={13} /> Protegido
            </span>
            <span className="flex items-center gap-1.5">
              <span className="block h-1 w-1 rounded-full bg-[var(--text-faint)]/50" /> Sem streak
            </span>
          </div>
        </div>
      </motion.div>
    </Modal>
  );
}
