"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WeeklyPlanItem } from "@/types";
import { formatLocalDate, parseIsoKey, SHORT_WEEKDAYS, todayIso } from "@/lib/planning/dates";
import { buildMonthGrid, isInCalendarMonth } from "@/lib/planning/month-grid";
import { EventChip } from "./EventChip";
import { Plus, X } from "lucide-react";
import { PlanRow, planItemKey } from "./PlanRow";

type SizeMode = "mobile" | "tablet" | "desktop";

interface MonthViewProps {
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  navigationDirection?: "prev" | "next" | "zoom" | null;
  importantDays: ReadonlyMap<string, readonly string[]>;
  importantDaysError?: string | null;
  plansError?: string | null;
  onDateSelect: (date: string) => void;
  onMonthNavigate?: (date: string, direction: "prev" | "next") => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onPlanCreate?: (date: string) => void;
  onToggleCompleted?: (plan: WeeklyPlanItem, completed: boolean) => Promise<void>;
  onEditPlan?: (plan: WeeklyPlanItem) => void;
  onDeletePlan?: (plan: WeeklyPlanItem) => void;
}

const CHIP_CAP_TABLET = 2;
const CHIP_CAP_DESKTOP = 3;
const POPOVER_WIDTH = 280;
const EMPTY_REASONS: readonly string[] = [];

export function MonthView({
  monthRange,
  plans,
  selectedDate,
  navigationDirection,
  importantDays,
  importantDaysError,
  plansError,
  onDateSelect,
  onMonthNavigate,
  onPrevMonth,
  onNextMonth,
  onPlanCreate,
  onToggleCompleted,
  onEditPlan,
  onDeletePlan,
}: MonthViewProps) {
  const reduced = useReducedMotion();
  const today = todayIso();
  const { year, month } = parseIsoKey(monthRange.start);
  const monthKey = monthRange.start.slice(0, 7);
  const dates = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const rowCount = dates.length / 7;
  const [sizeMode, setSizeMode] = useState<SizeMode>("desktop");
  const [popover, setPopover] = useState<{ date: string; left: number; top: number } | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [desktopChipCap, setDesktopChipCap] = useState(CHIP_CAP_DESKTOP);
  const popoverRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingFocusDate = useRef<string | null>(null);

  const isMobile = sizeMode === "mobile";

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1101px)");
    const tablet = window.matchMedia("(min-width: 640px) and (max-width: 1100px)");
    const update = () => setSizeMode(desktop.matches ? "desktop" : tablet.matches ? "tablet" : "mobile");
    update();
    desktop.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = (entry.contentRect.height - 32) / rowCount;
      if (measured > 0) setDesktopChipCap(measured < 132 ? CHIP_CAP_TABLET : CHIP_CAP_DESKTOP);
    });
    observer.observe(board);
    return () => observer.disconnect();
  }, [rowCount]);

  const chipCap = sizeMode === "mobile" ? 0 : sizeMode === "tablet"
    ? CHIP_CAP_TABLET
    : desktopChipCap;

  const plansByDate = useMemo(() => {
    const grouped = new Map<string, WeeklyPlanItem[]>();
    for (const plan of plans) {
      // Tarefas sem data não pertencem ao calendário (ficam em "Sem data").
      if (!plan.planDate) continue;
      const list = grouped.get(plan.planDate) ?? [];
      list.push(plan);
      grouped.set(plan.planDate, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }

    return grouped;
  }, [plans]);

  const selectedIndex = dates.indexOf(selectedDate);

  const setButtonRef = useCallback((date: string, element: HTMLButtonElement | null) => {
    if (element) cellRefs.current.set(date, element);
    else cellRefs.current.delete(date);
  }, []);

  const selectDate = useCallback(
    (date: string) => {
      if (isInCalendarMonth(date, year, month)) onDateSelect(date);
      else if (onMonthNavigate) onMonthNavigate(date, date < monthRange.start ? "prev" : "next");
      else onDateSelect(date);
      if (isMobile) setMobilePanelOpen(true);
    },
    [isMobile, month, monthRange.start, onDateSelect, onMonthNavigate, year],
  );

  useEffect(() => {
    const date = pendingFocusDate.current;
    if (date && date === selectedDate) {
      cellRefs.current.get(date)?.focus({ preventScroll: true });
      pendingFocusDate.current = null;
    }
  }, [monthKey, selectedDate]);

  const closePopover = useCallback(() => setPopover(null), []);

  useEffect(() => {
    if (!popover && !mobilePanelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (popover) closePopover();
        else setMobilePanelOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) closePopover();
    };
    const onScroll = () => closePopover();
    window.addEventListener("keydown", onKeyDown);
    if (popover) {
      document.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("scroll", onScroll, true);
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [closePopover, mobilePanelOpen, popover]);

  const openPopover = useCallback((event: React.SyntheticEvent, date: string) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 12));
    const top = rect.bottom + 10 + 360 > window.innerHeight
      ? Math.max(12, rect.top - 370)
      : rect.bottom + 10;
    setPopover({ date, left, top });
  }, []);

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const activeDate = (document.activeElement as HTMLElement | null)?.dataset.date;
      let index = activeDate ? dates.indexOf(activeDate) : selectedIndex;
      if (index < 0) index = 0;
      let next: number | null = null;

      switch (event.key) {
        case "ArrowRight":
          next = index + 1;
          break;
        case "ArrowLeft":
          next = index - 1;
          break;
        case "ArrowDown":
          next = index + 7;
          break;
        case "ArrowUp":
          next = index - 7;
          break;
        case "Home":
          next = Math.floor(index / 7) * 7;
          break;
        case "End":
          next = Math.min(Math.floor(index / 7) * 7 + 6, dates.length - 1);
          break;
        case "PageUp":
          event.preventDefault();
          onPrevMonth?.();
          return;
        case "PageDown":
          event.preventDefault();
          onNextMonth?.();
          return;
        default:
          return;
      }

      event.preventDefault();
      if (next < 0 || next >= dates.length) return;
      const date = dates[next];
      pendingFocusDate.current = date;
      selectDate(date);
      if (isInCalendarMonth(date, year, month)) {
        cellRefs.current.get(date)?.focus({ preventScroll: true });
        pendingFocusDate.current = null;
      }
    },
    [dates, month, onNextMonth, onPrevMonth, selectDate, selectedIndex, year],
  );

  const monthLabel = formatLocalDate(monthRange.start, { month: "long", year: "numeric" });
  const gridMinHeight = 32 + rowCount * 96;
  const slideDirection = navigationDirection === "prev" ? -1 : 1;
  const dayPlans = plansByDate.get(selectedDate) ?? [];
  const selectedReasons = importantDays.get(selectedDate) ?? EMPTY_REASONS;

  const renderPanel = () => (
    <SelectedDayPanel
      date={selectedDate}
      plans={dayPlans}
      importantReasons={selectedReasons}
      importantDaysError={importantDaysError}
      plansError={plansError}
      onPlanCreate={onPlanCreate}
      onToggleCompleted={onToggleCompleted}
      onEditPlan={onEditPlan}
      onDeletePlan={onDeletePlan}
      onClose={() => setMobilePanelOpen(false)}
      reduced={Boolean(reduced)}
    />
  );

  const renderPopover = () => {
    if (!popover || typeof document === "undefined") return null;
    const dayPlansForPopover = plansByDate.get(popover.date) ?? [];
    const label = `${formatLocalDate(popover.date, { weekday: "long" })}, ${formatLocalDate(popover.date, { day: "numeric", month: "long" })}`;
    return createPortal(
      <div
        ref={popoverRef}
        className="mv-popover"
        style={{ left: popover.left, top: popover.top }}
        role="dialog"
        aria-label={`Planos de ${label}`}
      >
        <div className="mv-popover-inner">
          <div className="mv-popover-header">
            <span className="mv-popover-title">{formatLocalDate(popover.date, { weekday: "long" })}</span>
            <span className="mv-popover-date">{formatLocalDate(popover.date, { day: "numeric", month: "long" })}</span>
          </div>
          <div className="mv-popover-list">
            {dayPlansForPopover.length === 0 ? (
              <p className="mv-popover-empty">Nada planejado para este dia.</p>
            ) : (
              dayPlansForPopover.map((plan) => (
                <PlanRow
                  key={planItemKey(plan)}
                  plan={plan}
                  compact
                  onToggleCompleted={(item, completed) => void onToggleCompleted?.(item, completed)}
                  onEdit={(item) => {
                    selectDate(popover.date);
                    closePopover();
                    onEditPlan?.(item);
                  }}
                  onDelete={(item) => {
                    closePopover();
                    onDeletePlan?.(item);
                  }}
                />
              ))
            )}
          </div>
          {onPlanCreate ? (
            <button
              type="button"
              className="mv-popover-add"
              onClick={() => {
                onPlanCreate(popover.date);
                closePopover();
              }}
            >
              + Adicionar
            </button>
          ) : null}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <div className={`mv-month mv-month--${sizeMode}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={monthKey}
          className="mv-month-layout"
          initial={{ opacity: 0, x: slideDirection * 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: slideDirection * -18 }}
          transition={{
            x: { type: "spring", stiffness: 380, damping: 34 },
            opacity: { duration: reduced ? 0 : 0.16 },
          }}
        >
        <section className="mv-calendar" aria-label={`Calendário de ${monthLabel}`}>
          <div ref={boardRef} className="mv-board" onKeyDown={handleGridKeyDown}>
            <div
              className="mv-grid"
              role="grid"
              aria-label={`Mês de ${monthLabel}`}
              style={{
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gridTemplateRows: `32px repeat(${rowCount}, minmax(96px, 1fr))`,
                minHeight: `max(100%, ${gridMinHeight}px)`,
              }}
            >
              {SHORT_WEEKDAYS.map((name) => (
                <div key={name} className="mv-weekday" role="columnheader" aria-label={name}>
                  {name}
                </div>
              ))}
              {dates.map((date, index) => (
                <MonthCell
                  key={date}
                  date={date}
                  dayPlans={plansByDate.get(date) ?? EMPTY_PLANS}
                  importantReasons={importantDays.get(date) ?? EMPTY_REASONS}
                  isAdjacent={!isInCalendarMonth(date, year, month)}
                  isToday={date === today}
                  isSelected={date === selectedDate}
                  isWeekend={index % 7 > 4}
                  chipCap={chipCap}
                  isMobile={isMobile}
                  selectedFocused={selectedIndex === index}
                  reduced={Boolean(reduced)}
                  onSelectDate={selectDate}
                  onPlanCreate={onPlanCreate}
                  onOpenPopover={openPopover}
                  setButtonRef={setButtonRef}
                />
              ))}
            </div>
          </div>

          <div className="mv-legend" aria-label="Legenda do calendário">
            <span><i className="mv-legend-today" aria-hidden="true" />Hoje</span>
            <span><i className="mv-legend-important" aria-hidden="true" />Dia importante</span>
            <span><i className="mv-legend-plans" aria-hidden="true" />Com tarefas</span>
          </div>
        </section>

        {sizeMode !== "mobile" ? renderPanel() : null}
        </motion.div>
      </AnimatePresence>

      {isMobile && mobilePanelOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="mv-sheet-backdrop" onClick={() => setMobilePanelOpen(false)}>
              <div className="mv-sheet" role="dialog" aria-modal="true" aria-label={`Agenda de ${selectedDate}`} onClick={(event) => event.stopPropagation()}>
                {renderPanel()}
              </div>
            </div>,
            document.body,
          )
        : null}
      {renderPopover()}
    </div>
  );
}

const EMPTY_PLANS: WeeklyPlanItem[] = [];

interface MonthCellProps {
  date: string;
  dayPlans: WeeklyPlanItem[];
  importantReasons: readonly string[];
  isAdjacent: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  chipCap: number;
  isMobile: boolean;
  selectedFocused: boolean;
  reduced: boolean;
  onSelectDate: (date: string) => void;
  onPlanCreate?: (date: string) => void;
  onOpenPopover: (event: React.SyntheticEvent, date: string) => void;
  setButtonRef: (date: string, element: HTMLButtonElement | null) => void;
}

const MonthCell = memo(function MonthCell({
  date,
  dayPlans,
  importantReasons,
  isAdjacent,
  isToday,
  isSelected,
  isWeekend,
  chipCap,
  isMobile,
  selectedFocused,
  reduced,
  onSelectDate,
  onPlanCreate,
  onOpenPopover,
  setButtonRef,
}: MonthCellProps) {
  const { day } = parseIsoKey(date);
  const monthName = formatLocalDate(date, { month: "long" });
  const dayLabel = `${day} de ${monthName}`;
  const completedCount = dayPlans.filter((plan) => Boolean(plan.completedAt)).length;
  const visibleChips = dayPlans.slice(0, chipCap);
  const hiddenCount = isMobile
    ? Math.max(0, dayPlans.length - 3)
    : Math.max(0, dayPlans.length - visibleChips.length);
  const importantLabel = importantReasons.length > 0 ? importantReasons.join("; ") : null;
  const ariaLabel = [
    dayLabel,
    isToday ? "hoje" : null,
    dayPlans.length ? `${dayPlans.length} ${dayPlans.length === 1 ? "plano" : "planos"}` : "sem planos",
    completedCount ? `${completedCount} concluídos` : null,
    importantLabel ? `dia importante: ${importantLabel}` : null,
  ].filter(Boolean).join(", ");

  const setRef = useCallback((element: HTMLButtonElement | null) => setButtonRef(date, element), [date, setButtonRef]);
  const quickAdd = useCallback(() => onPlanCreate?.(date), [date, onPlanCreate]);
  const weekday = formatLocalDate(date, { weekday: "long" });
  const cellClassName = [
    "mv-cell-wrap",
    isToday ? "mv-cell-wrap--today" : "",
    isSelected ? "mv-cell-wrap--selected" : "",
    isAdjacent ? "mv-cell-wrap--adjacent" : "",
    isWeekend ? "mv-cell-wrap--weekend" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cellClassName} role="gridcell" aria-selected={isSelected || undefined}>
      <button
        ref={setRef}
        type="button"
        data-date={date}
        className="mv-cell"
        onClick={() => onSelectDate(date)}
        aria-label={ariaLabel}
        title={importantLabel ?? undefined}
        aria-current={isToday ? "date" : undefined}
        tabIndex={selectedFocused ? 0 : -1}
      />

      <div className="mv-cell-content" aria-hidden="true">
        <div className="mv-cell-heading">
          <span className={`mv-number${isToday ? " mv-number--today" : ""}${isSelected ? " mv-number--selected" : ""}${isAdjacent ? " mv-number--adjacent" : ""}${importantLabel ? " mv-number--important" : ""}`} title={importantLabel ?? undefined}>
            {day}
          </span>
          {dayPlans.length > 0 ? <span className="mv-has-plans-dot" /> : null}
          {importantLabel ? <span className="mv-important-mark" title={`Importante: ${importantLabel}`} aria-label={`Importante: ${importantLabel}`}>!</span> : null}
        </div>

        {isMobile ? (
          <div className="mv-dots">
            {dayPlans.slice(0, 3).map((plan) => (
              <span
                key={planItemKey(plan)}
                className="mv-dot"
                style={{
                  backgroundColor: plan.completedAt ? "var(--text-muted)" : plan.color || plan.category.color,
                  opacity: plan.completedAt ? 0.45 : 1,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mv-chips">
            {visibleChips.map((plan) => (
              <motion.div
                key={planItemKey(plan)}
                className="mv-chip-motion"
                initial={reduced ? false : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.16, ease: "easeOut" }}
              >
                <EventChip plan={plan} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {onPlanCreate && !isMobile ? (
        <button
          type="button"
          className="mv-quick-add"
          onClick={(event) => {
            event.stopPropagation();
            quickAdd();
          }}
          aria-label={`Adicionar plano para ${weekday}, ${dayLabel}`}
          title="Adicionar plano"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      ) : null}

      {hiddenCount > 0 ? (
        <button
          type="button"
          className={`mv-pill${isMobile ? " mv-pill--mobile" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPopover(event, date);
          }}
          aria-label={`Mostrar mais ${hiddenCount} planos de ${dayLabel}`}
        >
          +{hiddenCount} mais
        </button>
      ) : null}
    </div>
  );
});

interface SelectedDayPanelProps {
  date: string;
  plans: WeeklyPlanItem[];
  importantReasons: readonly string[];
  importantDaysError?: string | null;
  plansError?: string | null;
  onPlanCreate?: (date: string) => void;
  onToggleCompleted?: (plan: WeeklyPlanItem, completed: boolean) => Promise<void>;
  onEditPlan?: (plan: WeeklyPlanItem) => void;
  onDeletePlan?: (plan: WeeklyPlanItem) => void;
  onClose: () => void;
  reduced: boolean;
}

function SelectedDayPanel({
  date,
  plans,
  importantReasons,
  importantDaysError,
  plansError,
  onPlanCreate,
  onToggleCompleted,
  onEditPlan,
  onDeletePlan,
  onClose,
  reduced,
}: SelectedDayPanelProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const { day } = parseIsoKey(date);
  const weekday = formatLocalDate(date, { weekday: "long" });
  const monthYear = formatLocalDate(date, { month: "long", year: "numeric" });
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")),
    [plans],
  );

  const toggleTask = async (plan: WeeklyPlanItem, completed: boolean) => {
    if (!onToggleCompleted) return;
    setActionError(null);
    try {
      await onToggleCompleted(plan, completed);
    } catch {
      setActionError("Não foi possível atualizar a tarefa. Tente novamente.");
    }
  };

  return (
    <aside className="mv-day-panel">
      <div className="mv-panel-topline">
        <span className="mv-panel-eyebrow">Dia selecionado</span>
        <button type="button" className="mv-panel-close" onClick={onClose} aria-label="Fechar agenda do dia">
          <X size={16} />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={date}
          className="mv-panel-content"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -3 }}
          transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
          aria-live="polite"
        >
          <header className="mv-selected-date">
            <span className="mv-selected-date__number">{day}</span>
            <div className="min-w-0">
              <p className="mv-selected-date__weekday">{weekday}</p>
              <h2 className="mv-selected-date__month">{monthYear}</h2>
            </div>
          </header>

          {importantReasons.length > 0 ? (
            <div className="mv-panel-important">
              <span className="mv-panel-important__ring" aria-hidden="true">!</span>
              <div>
                <p className="mv-panel-section-title">Dia importante</p>
                {importantReasons.map((reason) => <p key={reason} className="mv-panel-important__reason">{reason}</p>)}
              </div>
            </div>
          ) : null}

          {importantDaysError ? <p className="mv-panel-error" role="status">{importantDaysError}</p> : null}
          {plansError ? <p className="mv-panel-error" role="status">{plansError}</p> : null}
          {actionError ? <p className="mv-panel-error" role="alert">{actionError}</p> : null}

          <section className="mv-panel-section" aria-labelledby="mv-plans-heading">
            <h3 id="mv-plans-heading" className="mv-panel-section-title">Tarefas e agenda</h3>
            {sortedPlans.length > 0 ? (
              <div className="mv-panel-task-list">
                {sortedPlans.map((plan) => (
                  <PlanRow
                    key={planItemKey(plan)}
                    plan={plan}
                    compact
                    onToggleCompleted={(item, completed) => void toggleTask(item, completed)}
                    onEdit={(item) => onEditPlan?.(item)}
                    onDelete={(item) => onDeletePlan?.(item)}
                  />
                ))}
              </div>
            ) : (
              <p className="mv-panel-empty">Nenhum plano para este dia.</p>
            )}
          </section>

          {onPlanCreate ? (
            <button type="button" className="mv-panel-add mv-panel-add--footer" onClick={() => onPlanCreate(date)}>
              <Plus size={14} aria-hidden="true" /> Adicionar
            </button>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
