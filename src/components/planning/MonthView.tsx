"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WeeklyPlanItem } from "@/types";
import { addDays, daysInMonth, formatLocalDate, isoKey, todayIso, SHORT_WEEKDAYS } from "@/lib/planning/dates";
import { EventChip } from "./EventChip";
import { Plus } from "lucide-react";

type SizeMode = "mobile" | "tablet" | "desktop";

interface MonthViewProps {
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onMonthNavigate?: (date: string) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onPlanCreate?: (date: string) => void;
}

const CHIP_CAP_TABLET = 2;
const CHIP_CAP_DESKTOP = 3;

export function MonthView({
  monthRange,
  plans,
  selectedDate,
  onDateSelect,
  onMonthNavigate,
  onPrevMonth,
  onNextMonth,
  onPlanCreate,
}: MonthViewProps) {
  const today = todayIso();
  const year = parseInt(monthRange.start.slice(0, 4), 10);
  const month = parseInt(monthRange.start.slice(5, 7), 10);
  const monthKey = monthRange.start.slice(0, 7);

  const total = daysInMonth(monthRange.start);
  const firstOfMonth = new Date(year, month - 1, 1);
  const lead = (firstOfMonth.getDay() + 6) % 7; // segunda=0 … domingo=6

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < lead; i++) out.push(addDays(isoKey(year, month, 1), i - lead));
    for (let i = 1; i <= total; i++) out.push(isoKey(year, month, i));
    const tail = (-out.length) % 7;
    for (let i = 1; i <= tail; i++) out.push(addDays(monthRange.end, i));
    return out;
  }, [year, month, total, monthRange.end, lead]);

  const rowCount = days.length / 7;

  const plansByDate = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem[]>();
    for (const p of plans) {
      const list = map.get(p.planDate) ?? [];
      list.push(p);
      map.set(p.planDate, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [plans]);

  const isToday = (d: string) => d === today;
  const isSelected = (d: string) => d === selectedDate;
  const isCurrentMonth = (d: string) => d.slice(0, 7) === monthKey;

  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [sizeMode, setSizeMode] = useState<SizeMode>("desktop");
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ date: string; left: number; top: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isMobile = sizeMode === "mobile";
  const isTablet = sizeMode === "tablet";
  const chipCap = isMobile ? 0 : isTablet ? CHIP_CAP_TABLET : CHIP_CAP_DESKTOP;

  // Media queries para ajustar densidade da grade.
  useEffect(() => {
    const mqlDesktop = window.matchMedia("(min-width: 1024px)");
    const mqlTablet = window.matchMedia("(min-width: 640px) and (max-width: 1023px)");
    const update = () => {
      setSizeMode(mqlDesktop.matches ? "desktop" : mqlTablet.matches ? "tablet" : "mobile");
    };
    update();
    mqlDesktop.addEventListener("change", update);
    mqlTablet.addEventListener("change", update);
    return () => {
      mqlDesktop.removeEventListener("change", update);
      mqlTablet.removeEventListener("change", update);
    };
  }, []);

  const selectedIdx = days.indexOf(selectedDate);

  const closePopover = useCallback(() => setPopover(null), []);

  // Fecha o popover: Escape + clique fora.
  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) closePopover();
    };
    const onScroll = () => closePopover();
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [popover, closePopover]);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const cells = Array.from(cellRefs.current.values());
      const n = cells.length;
      if (n === 0) return;
      const active = document.activeElement;
      let focusIdx = cells.indexOf(active as HTMLButtonElement);
      if (focusIdx < 0) focusIdx = selectedIdx >= 0 ? selectedIdx : 0;
      const row = Math.floor(focusIdx / 7);
      const col = focusIdx % 7;
      let next: number | null = null;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          next = col < 6 ? focusIdx + 1 : null;
          break;
        case "ArrowLeft":
          e.preventDefault();
          next = col > 0 ? focusIdx - 1 : null;
          break;
        case "ArrowDown":
          e.preventDefault();
          next = row < rowCount - 1 ? focusIdx + 7 : null;
          break;
        case "ArrowUp":
          e.preventDefault();
          next = row > 0 ? focusIdx - 7 : null;
          break;
        case "Home":
          e.preventDefault();
          next = row * 7;
          break;
        case "End":
          e.preventDefault();
          next = Math.min(row * 7 + 6, n - 1);
          break;
        case "PageUp":
          e.preventDefault();
          onPrevMonth?.();
          break;
        case "PageDown":
          e.preventDefault();
          onNextMonth?.();
          break;
      }
      if (next !== null) cells[next]?.focus({ preventScroll: true });
    },
    [rowCount, selectedIdx, onPrevMonth, onNextMonth],
  );

  const openPopover = useCallback((e: React.SyntheticEvent, date: string) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 12));
    let top = r.bottom + 10;
    if (top + POPBOTTOM_PAD > window.innerHeight) {
      top = Math.max(12, r.top - POPBOTTOM_PAD - 10);
    }
    setPopover({ date, left, top });
  }, []);

  const monthLabel = formatLocalDate(monthRange.start, { month: "long", year: "numeric" });

  const rows: string[][] = [];
  for (let r = 0; r < rowCount; r++) rows.push(days.slice(r * 7, (r + 1) * 7));

  const renderPopover = () => {
    if (!popover) return null;
    const visible = isCurrentMonth(popover.date) ? popover : null;
    if (!visible) return null;
    const dayPlans = [...(plansByDate.get(visible.date) ?? [])].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    return createPortal(
      <div
        ref={popoverRef}
        className="mv-popover"
        style={{ left: visible.left, top: visible.top }}
        role="dialog"
        aria-label={`Planos de ${formatLocalDate(visible.date, { weekday: "long" })}, ${formatLocalDate(visible.date, { day: "numeric", month: "long" })}`}
      >
        <div className="mv-popover-inner">
          <div className="mv-popover-header">
            <span className="mv-popover-title">{formatLocalDate(visible.date, { weekday: "long" })}</span>
            <span className="mv-popover-date">{formatLocalDate(visible.date, { day: "numeric", month: "long" })}</span>
          </div>
          <div className="mv-popover-list">
            {dayPlans.length === 0 ? (
              <p className="mv-popover-empty">Nenhum plano para este dia.</p>
            ) : (
              dayPlans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="mv-popover-event"
                  onClick={() => {
                    onDateSelect(p.planDate);
                    closePopover();
                  }}
                >
                  <span className="mv-chip__dot" style={{ backgroundColor: p.color || p.category.color }} aria-hidden="true" />
                  <span className="mv-popover-event__title">{p.title || "(sem título)"}</span>
                  <span className="mv-popover-event__time">{p.startTime ?? ""}</span>
                </button>
              ))
            )}
          </div>
          {onPlanCreate ? (
            <button
              type="button"
              className="mv-popover-add"
              onClick={() => {
                onPlanCreate(visible.date);
                closePopover();
              }}
            >
              + Adicionar plano
            </button>
          ) : null}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <div className="mv-month flex min-h-0 flex-1 flex-col">
      <div className="mv-month-grid flex min-h-0 flex-1 flex-col" onKeyDown={handleGridKeyDown}>
        {/* Rótulos dos dias da semana (mesma grade de 7 colunas). */}
        <div className="grid shrink-0 grid-cols-7" style={{ gap: 0 }}>
          {SHORT_WEEKDAYS.map((name) => (
            <div key={name} className="mv-weekday flex items-center justify-center px-2 py-2" aria-hidden="true">
              {name}
            </div>
          ))}
        </div>

        {/* Linhas do mês — cada uma com altura igual (flex-1). */}
        {rows.map((week, r) => (
          <div key={r} className="mv-week-row flex min-h-0 flex-1" style={{ gap: 0 }}>
            {week.map((date, c) => {
              const dayPlans = plansByDate.get(date) ?? [];
              return (
                <MonthCell
                  key={date}
                  date={date}
                  dayPlans={dayPlans}
                  isAdjacent={!isCurrentMonth(date)}
                  isToday={date === today}
                  isSelected={date === selectedDate}
                  hov={hoverDate === date}
                  chipCap={chipCap}
                  isMobile={isMobile}
                  selectedFocused={selectedIdx >= 0 && r * 7 + c === selectedIdx}
                  onSelect={onDateSelect}
                  onMonthNavigate={onMonthNavigate}
                  onQuickAdd={() => onPlanCreate?.(date)}
                  onOpenPopover={openPopover}
                />
              );
            })}
          </div>
        ))}
      </div>

      {renderPopover()}
    </div>
  );
}

// ── Célula do dia ──────────────────────────────────────────────────────────

interface MonthCellProps {
  date: string;
  dayPlans: WeeklyPlanItem[];
  isAdjacent: boolean;
  isToday: boolean;
  isSelected: boolean;
  hov: boolean;
  chipCap: number;
  isMobile: boolean;
  selectedFocused: boolean;
  onSelect: (date: string) => void;
  onMonthNavigate?: (date: string) => void;
  onQuickAdd: () => void;
  onOpenPopover: (e: React.SyntheticEvent, date: string) => void;
}

function MonthCell({
  date,
  dayPlans,
  isAdjacent,
  isToday,
  isSelected,
  hov,
  chipCap,
  isMobile,
  selectedFocused,
  onSelect,
  onMonthNavigate,
  onQuickAdd,
  onOpenPopover,
}: MonthCellProps) {
  const cellEl = useRef<HTMLButtonElement>(null);
  const [mx, setMx] = useState(0.5);
  const [my, setMy] = useState(0.5);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const tiltZ = hov ? 18 : 0;
  const chipZ = hov ? 14 : 0;
  const pointerRaf = useRef(0);

  const setCellRef = useCallback((el: HTMLButtonElement | null) => {
    cellEl.current = el;
  }, []);

  const cellPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(pointerRaf.current);
      pointerRaf.current = requestAnimationFrame(() => {
        const rect = cellEl.current!.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
        setMx(x);
        setMy(y);
        setTiltX((y - 0.5) * 8);
        setTiltY((x - 0.5) * 8);
      });
    },
    [],
  );

  const monthName = formatLocalDate(date, { month: "long" });
  const dayNumber = parseInt(date.slice(8, 10), 10);
  const total = dayPlans.length;
  const done = dayPlans.filter((p) => Boolean(p.completedAt)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const visibleChips = dayPlans.slice(0, chipCap);
  const hiddenCount = dayPlans.length - visibleChips.length;
  const showPill = chipCap > 0 && hiddenCount > 0;

  const cellClasses = [
    "mv-cell",
    isToday ? "mv-cell--today" : "",
    isSelected ? "mv-cell--selected" : "",
    isAdjacent ? "mv-cell--adjacent" : "",
    hov ? "mv-cell--hover" : "",
    "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2.5 py-2 text-left cursor-pointer transition-[background_color,border_color,box-shadow] duration-150 ease-out hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaDone = done === 0 ? "sem concluídos" : done === 1 ? "1 concluído" : `${done} concluídos`;
  const ariaTotal = total === 0 ? "sem planos" : total === 1 ? "1 plano" : `${total} planos`;
  const ariaLabel = `${dayNumber} de ${monthName}, ${ariaTotal}, ${ariaDone}${isToday ? ", hoje" : ""}`;

  return (
    <button
      type="button"
      ref={setCellRef}
      onClick={(e) => {
        e.stopPropagation();
        if (isAdjacent) onMonthNavigate?.(date);
        else onSelect(date);
      }}
      onDoubleClick={() => onQuickAdd()}
      onPointerMove={cellPointerMove}
      className={cellClasses}
      aria-label={ariaLabel}
      aria-current={isToday ? "date" : undefined}
      aria-selected={isSelected || undefined}
      tabIndex={selectedFocused ? 0 : -1}
    >
      <div
        className="mv-cell-inner relative flex min-h-0 w-full flex-col"
        style={
          {
            "--mv-mx": mx,
            "--mv-my": my,
            "--mv-tilt-x": `${tiltX}deg`,
            "--mv-tilt-y": `${tiltY}deg`,
            "--mv-tilt-z": `${tiltZ}px`,
            "--mv-chip-z": `${chipZ}px`,
            transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(${tiltZ}px)`,
          } as unknown as React.CSSProperties
        }
      >
        {/* Número do dia */}
        <div className="flex w-full items-start justify-between gap-1 pt-0.5">
          <span
            className={`mv-number ${isToday ? "mv-number--today" : ""} ${isSelected ? "mv-number--selected" : ""} ${isAdjacent ? "mv-number--adjacent" : ""}`}
          >
            {dayNumber}
          </span>
          {(isMobile || hov) && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Adicionar plano para ${dayNumber} de ${monthName}`}
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd();
              }}
              className="mv-quick-add"
            >
              <Plus size={11} aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Eventos / pontos */}
        {isMobile ? (
          <div className="mv-dots mt-1 flex w-full items-center gap-1">
            {dayPlans.slice(0, 3).map((p) => {
              const completed = Boolean(p.completedAt);
              const color = p.color || p.category.color;
              return (
                <span
                  key={p.id}
                  className="mv-dot rounded-full"
                  style={{
                    backgroundColor: completed ? "var(--text-muted)" : color,
                    opacity: completed ? 0.45 : 1,
                  }}
                  aria-hidden="true"
                />
              );
            })}
            {total > 3 && <span className="mv-dot-more text-[10px] font-bold text-[var(--text-faint)]">+{total - 3}</span>}
          </div>
        ) : (
          <div className="mv-chips mt-1 flex w-full flex-col gap-1">
            {visibleChips.map((p) => (
              <EventChip key={p.id} plan={p} onClick={() => onSelect(date)} />
            ))}
            {showPill && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`+${hiddenCount} mais planos em ${dayNumber} de ${monthName}`}
                onClick={(e) => onOpenPopover(e, date)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenPopover(e, date);
                  }
                }}
                className="mv-pill"
              >
                +{hiddenCount} mais
              </span>
            )}
          </div>
        )}

        {/* Barra de progresso da carga de trabalho (somente leitura). */}
        {!isMobile && total > 0 && (
          <div className="mv-workload" title={`${done} de ${total} concluídos`} aria-hidden="true">
            <div className="mv-workload-fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
        )}
      </div>
    </button>
  );
}
