"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DatePickerProps {
  value: string; // YYYY-MM-DD or empty string
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = "Selecione uma data", className = "" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const parsed = value ? parseISO(value) : new Date();
    return isValid(parsed) ? parsed : new Date();
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
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

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] cursor-pointer hover:border-[var(--text-muted)] transition-colors"
      >
        <CalendarDays size={15} className="text-[var(--text-faint)] pointer-events-none" />
        <span className="text-sm text-[var(--text)]">{formatDate(value)}</span>
      </div>

      {/* Popover - portaled to body to avoid overflow issues */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[200] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 w-80"
            style={{
              top: triggerRef.current ? triggerRef.current.getBoundingClientRect().bottom + 8 : 0,
              left: triggerRef.current ? Math.max(8, Math.min(triggerRef.current.getBoundingClientRect().left, window.innerWidth - 320 - 8)) : 0,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
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
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
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
                    onClick={() => handleSelectDate(day)}
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
                  onClick={() => handleQuickSelect(0)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(7)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Em 1 semana
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(30)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Em 1 mês
                </button>
              </div>

              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <X size={12} />
                Limpar
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
