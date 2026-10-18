"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DatePickerProps {
  value: string; // YYYY-MM-DD or empty string
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Z-index layering (both Modal and DatePicker are portaled to document.body,
 * so they share the same stacking context):
 *   - Modal wrapper / backdrop: z-index 999 (MODAL_Z_INDEX)
 *   - DatePicker popover:    z-index 1050 — above the modal panel so the
 *     calendar is never hidden behind the modal backdrop.
 */
const POPOVER_WIDTH = 320; // w-80
const POPOVER_HEIGHT = 440; // approximate rendered height
const POPOVER_GAP = 8; // distance from trigger

export function DatePicker({ value, onChange, placeholder = "Selecione uma data", className = "" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const parsed = value ? parseISO(value) : new Date();
    return isValid(parsed) ? parsed : new Date();
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; placement: "bottom" | "top" } | null>(null);
  const reduced = useReducedMotion();

  // --- Positioning ---------------------------------------------------------
  // Computed in an effect (not inline during render) to avoid forced synchronous
  // layout from getBoundingClientRect() on every render.
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Horizontal: center the popover on the trigger, clamped to viewport edges.
      const left = Math.max(POPOVER_GAP, Math.min(
        triggerRect.left + triggerRect.width / 2 - POPOVER_WIDTH / 2,
        viewportWidth - POPOVER_WIDTH - POPOVER_GAP,
      ));

      // Try bottom placement first.
      const bottomTop = triggerRect.bottom + POPOVER_GAP;
      if (bottomTop + POPOVER_HEIGHT <= viewportHeight) {
        setPosition({ top: bottomTop, left, placement: "bottom" });
        return;
      }

      // Fall back to top placement.
      const topTop = triggerRect.top - POPOVER_HEIGHT - POPOVER_GAP;
      if (topTop >= 0) {
        setPosition({ top: topTop, left, placement: "top" });
        return;
      }

      // Not enough space either way: clamp to viewport and render anyway.
      setPosition({ top: Math.max(POPOVER_GAP, Math.min(bottomTop, viewportHeight - POPOVER_HEIGHT - POPOVER_GAP)), left, placement: "bottom" });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [isOpen]);

  // --- Outside click / Escape ---------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Stop propagation so the click does not reach the Modal backdrop and
      // accidentally close the entire goal modal — only the picker closes.
      e.stopPropagation();
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // keep the modal open; only the picker closes
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return placeholder;
    const parsed = parseISO(dateStr);
    if (!isValid(parsed)) return placeholder;
    return format(parsed, "dd/MM/yyyy", { locale: ptBR });
  };

  const handleSelectDate = (date: Date) => {
    const formatted = format(date, "yyyy-MM-dd");
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const handleQuickSelect = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    handleSelectDate(date);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const monthStart = startOfMonth(currentMonth);
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const slide = position?.placement === "bottom" ? [0, 8] : [0, -8];

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation(); // prevent the click from reaching modal backdrop
          setIsOpen((prev) => !prev);
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] cursor-pointer hover:border-[var(--text-muted)] transition-colors"
      >
        <CalendarDays size={15} className="text-[var(--text-faint)] pointer-events-none" />
        <span className="text-sm text-[var(--text)]">{formatDate(value)}</span>
      </div>

      {/* Popover — portaled to document.body so no modal ancestor can clip it. */}
      {isOpen && position ? (
        createPortal(
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.96, y: slide[1] }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: slide[1] }}
            transition={{ duration: reduced ? 0 : 0.15 }}
            className="fixed z-[1050] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,.35)] p-4 w-80"
            style={{ top: position.top, left: position.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMonth(subMonths(currentMonth, 1));
                }}
                className="p-1 rounded hover:bg-[var(--bg-surface-active)] transition-colors"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} className="text-[var(--text)]" />
              </button>
              <span className="text-sm font-semibold text-[var(--text)]">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMonth(addMonths(currentMonth, 1));
                }}
                className="p-1 rounded hover:bg-[var(--bg-surface-active)] transition-colors"
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} className="text-[var(--text)]" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day} className="text-[10px] font-medium text-[var(--text-faint)] text-center uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Padding days */}
              {paddingDays.map((i) => (
                <div key={`pad-${i}`} className="h-8" />
              ))}

              {/* Actual days */}
              {days.map((day) => {
                const isSelected = value && isSameDay(day, parseISO(value));
                const isTodayDate = isToday(day);
                const isPastDay = day < new Date() && !isTodayDate;

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectDate(day);
                    }}
                    className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[var(--accent)] text-[#07111f]"
                        : isTodayDate
                        ? "bg-[var(--bg-surface-active)] text-[var(--accent)] border border-[var(--accent)]"
                        : isPastDay
                        ? "text-[var(--text-faint)] opacity-60"
                        : "text-[var(--text)] hover:bg-[var(--bg-surface-active)]"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            {/* Quick actions */}
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuickSelect(0); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuickSelect(7); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Em 1 semana
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleQuickSelect(30); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Em 1 mês
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <X size={12} />
                Limpar
              </button>
            </div>
          </motion.div>,
          document.body,
        )
      ) : null}
    </div>
  );
}
