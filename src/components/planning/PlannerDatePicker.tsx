"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  formatLocalDate,
  parseIsoKey,
  SHORT_WEEKDAYS,
  todayIso,
  weekStart,
} from "@/lib/planning/dates";
import { buildMonthGrid } from "@/lib/planning/month-grid";

interface PlannerDatePickerProps {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

const POPOVER_GAP = 8;

export function PlannerDatePicker({
  id,
  value,
  onChange,
  label,
  placeholder = "Selecione uma data",
  disabled = false,
}: PlannerDatePickerProps) {
  const today = todayIso();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value || today);
  const [activeDate, setActiveDate] = useState(value || today);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const { year, month: monthNumber } = parseIsoKey(month);
  const monthDates = buildMonthGrid(year, monthNumber);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openPicker = () => {
    const date = value || today;
    setMonth(date);
    setActiveDate(date);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - POPOVER_GAP * 2);
      const height = 370;
      const left = Math.max(POPOVER_GAP, Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - POPOVER_GAP,
      ));
      const below = rect.bottom + POPOVER_GAP;
      const top = below + height <= window.innerHeight
        ? below
        : Math.max(POPOVER_GAP, Math.min(rect.top - height - POPOVER_GAP, window.innerHeight - height - POPOVER_GAP));
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        !triggerRef.current?.contains(event.target as Node)
        && !popoverRef.current?.contains(event.target as Node)
      ) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => dayRefs.current.get(activeDate)?.focus({ preventScroll: true }));
  }, [activeDate, month, open]);

  const selectDate = (date: string) => {
    onChange(date);
    close(true);
  };

  const moveActiveDate = (nextDate: string) => {
    setActiveDate(nextDate);
    setMonth(nextDate);
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextDate: string | null = null;
    if (event.key === "ArrowLeft") nextDate = addDays(activeDate, -1);
    else if (event.key === "ArrowRight") nextDate = addDays(activeDate, 1);
    else if (event.key === "ArrowUp") nextDate = addDays(activeDate, -7);
    else if (event.key === "ArrowDown") nextDate = addDays(activeDate, 7);
    else if (event.key === "Home") nextDate = weekStart(activeDate);
    else if (event.key === "End") nextDate = addDays(weekStart(activeDate), 6);
    else if (event.key === "PageUp") nextDate = addMonths(activeDate, event.shiftKey ? -12 : -1);
    else if (event.key === "PageDown") nextDate = addMonths(activeDate, event.shiftKey ? 12 : 1);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(activeDate);
      return;
    }
    if (nextDate) {
      event.preventDefault();
      moveActiveDate(nextDate);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => open ? close() : openPicker()}
        className="glass-field flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={value ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
          {value ? formatLocalDate(value, { day: "2-digit", month: "2-digit", year: "numeric" }) : placeholder}
        </span>
        <CalendarDays size={16} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      {open && position ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Calendário: ${label}`}
          className="planner-glass-popover fixed z-[1100] max-h-[calc(100dvh-1rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto p-3"
          style={{ top: position.top, left: position.left }}
        >
          <header className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => {
                const previous = addMonths(month, -1);
                setMonth(previous);
                setActiveDate(previous);
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold capitalize text-[var(--text)]">
              {formatLocalDate(`${month.slice(0, 7)}-01`, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => {
                const next = addMonths(month, 1);
                setMonth(next);
                setActiveDate(next);
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </header>

          <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
            {SHORT_WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-1 text-center text-[10px] font-semibold uppercase text-[var(--text-faint)]">
                {weekday}
              </span>
            ))}
          </div>
          <div
            role="group"
            aria-label={formatLocalDate(`${month.slice(0, 7)}-01`, { month: "long", year: "numeric" })}
            onKeyDown={handleGridKeyDown}
            className="grid grid-cols-7 gap-1"
          >
            {monthDates.map((date) => {
              const outsideMonth = date.slice(0, 7) !== month.slice(0, 7);
              const selected = date === value;
              const isToday = date === today;
              const { day } = parseIsoKey(date);
              return (
                <button
                  key={date}
                  ref={(element) => {
                    if (element) dayRefs.current.set(date, element);
                    else dayRefs.current.delete(date);
                  }}
                  type="button"
                  aria-label={formatLocalDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={selected}
                  tabIndex={activeDate === date ? 0 : -1}
                  onFocus={() => setActiveDate(date)}
                  onClick={() => selectDate(date)}
                  className={`grid aspect-square place-items-center rounded-lg text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ${
                    selected
                      ? "bg-[var(--accent)] font-bold text-[var(--bg-primary)]"
                      : isToday
                        ? "border border-[var(--accent)] bg-[var(--accent-bg)] font-semibold text-[var(--accent)]"
                        : outsideMonth
                          ? "text-[var(--text-faint)] opacity-50 hover:bg-[var(--bg-surface-hover)]"
                          : "text-[var(--text)] hover:bg-[var(--bg-surface-hover)]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <footer className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
            <span className="text-[11px] text-[var(--text-faint)]">
              {value ? formatLocalDate(value, { day: "numeric", month: "short", year: "numeric" }) : placeholder}
            </span>
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-bg)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              Hoje
            </button>
          </footer>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
