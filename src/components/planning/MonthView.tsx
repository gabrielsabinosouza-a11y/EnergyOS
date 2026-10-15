"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Variants, useReducedMotion } from "framer-motion";
import type { WeeklyPlanItem } from "@/types";
import {
  addDays,
  daysInMonth,
  formatLocalDate,
  isoKey,
  todayIso,
} from "@/lib/planning/dates";
import { SHORT_WEEKDAYS } from "@/lib/planning/dates";
import { TaskCard } from "@/components/planning/TaskCard";
import { ArrowRight, Plus, X } from "lucide-react";

type SizeMode = "mobile" | "tablet" | "desktop";

interface MonthViewProps {
  monthRange: { start: string; end: string };
  plans: WeeklyPlanItem[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  /** Navega para o mês da data informada (dias de outros meses), sem mudar de vista. */
  onMonthNavigate?: (date: string) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onPlanCreate?: (date: string) => void;
  onToggleCompleted?: (id: number, completed: boolean) => void;
  onDelete?: (id: number) => void;
  /** Direção da transição de página para este montamento ("next" | "prev" | "zoom"). */
  navDirection?: "next" | "prev" | "zoom" | null;
  /** Altura da barra de ferramentas do cabeçalho (px), medida pela página. */
  headerHeight?: number;
  /** Entrada com stagger só na primeira vez que o mês é montado. */
  firstMount?: boolean;
}

const MIN_ROW_HEIGHT = { desktop: 96, tablet: 70, mobile: 52 };
const CHIP_PITCH = 18;
const CELL_OVERHEAD = 36; // day number + padding + gaps
const POPOVER_WIDTH = 270;
const POPBOTTOM_PAD = 320;

const cellEase = [0.16, 1, 0.3, 1] as const;

export function MonthView({
  monthRange,
  plans,
  selectedDate,
  onDateSelect,
  onMonthNavigate,
  onPrevMonth,
  onNextMonth,
  onPlanCreate,
  onToggleCompleted,
  onDelete,
  navDirection = null,
}: MonthViewProps) {
  const reduced = useReducedMotion();
  const today = todayIso();
  const year = parseInt(monthRange.start.slice(0, 4), 10);
  const month = parseInt(monthRange.start.slice(5, 7), 10);
  const monthKey = monthRange.start.slice(0, 7);

  const total = daysInMonth(monthRange.start);
  const firstOfMonth = new Date(year, month - 1, 1);
  const lead = (firstOfMonth.getDay() + 6) % 7; // Monday=0 … Sunday=6

  const days = useMemo(() => {
    const out: string[] = [];
    // Previous month days
    for (let i = 0; i < lead; i++) out.push(addDays(isoKey(year, month, 1), i - lead));
    // Current month days
    for (let i = 1; i <= total; i++) out.push(isoKey(year, month, i));
    // Next month days (fill to complete grid)
    const tail = (-out.length) % 7;
    for (let i = 1; i <= tail; i++) out.push(addDays(monthRange.end, i));
    return out;
  }, [year, month, total, monthRange.end, lead]);
  const rowCount = days.length / 7;

  const plansByDate = new Map<string, WeeklyPlanItem[]>();
  for (const p of plans) {
    const list = plansByDate.get(p.planDate) ?? [];
    list.push(p);
    plansByDate.set(p.planDate, list);
  }

  const isToday = (d: string) => d === today;
  const isSelected = (d: string) => d === selectedDate;
  const isCurrentMonth = (d: string) => d.slice(0, 7) === monthKey;

  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const [chipLimit, setChipLimit] = useState(3);
  const [sizeMode, setSizeMode] = useState<SizeMode>("desktop");
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ date: string; left: number; top: number } | null>(null);
  const popoverEl = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const selectedIdx = days.indexOf(selectedDate);
  const visiblePopover = popover && isCurrentMonth(popover.date) ? popover : null;

  const isMobile = sizeMode === "mobile";
  const isTablet = sizeMode === "tablet";
  const chipCap = isMobile ? 0 : isTablet ? 2 : 3;

  // Media queries for responsive density
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

  // Measure grid height to determine chip capacity
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const box = entry.borderBoxSize?.[0];
      const h = box ? box.blockSize : entry.contentRect.height;
      const rowGap = 8;
      const cellH = Math.max(1, (h - rowGap * Math.max(0, rowCount - 1)) / rowCount);
      const avail = cellH - CELL_OVERHEAD;
      let n = Math.floor(avail / CHIP_PITCH);
      if (chipCap === 0) n = 0;
      else n = Math.max(1, Math.min(chipCap, n));
      setChipLimit(n);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowCount, chipCap, isMobile]);

  // Close popover on month change
  const closePopover = useCallback(() => setPopover(null), []);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (visiblePopover) {
        if (e.key === "Escape") setPopover(null);
        return;
      }
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
    [rowCount, visiblePopover, selectedIdx, onPrevMonth, onNextMonth],
  );

  const handleCellClick = useCallback(
    (e: React.MouseEvent, date: string, cur: boolean) => {
      e.stopPropagation();
      if (!cur) {
        onMonthNavigate?.(date);
        return;
      }
      onDateSelect(date);
    },
    [onDateSelect, onMonthNavigate],
  );

  const openPopover = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent, date: string) => {
      e.stopPropagation();
      const r = pillRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 12));
      let top = r.bottom + 10;
      if (top + POPBOTTOM_PAD > window.innerHeight) {
        top = Math.max(12, r.top - POPBOTTOM_PAD - 10);
      }
      setPopover({ date, left, top });
    },
    [],
  );

  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    const onDown = (e: MouseEvent) => {
      if (popoverEl.current && !popoverEl.current.contains(e.target as Node)) closePopover();
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

  // ── Motion Variants ─────────────────

  const monthLabel = formatLocalDate(monthRange.start, { month: "long", year: "numeric" });

  const cellDuration = reduced ? 0 : 0.28;
  const cellStagger = false; // Disable stagger for simpler animations

  const navVariantsMemo: Variants = useMemo(
    () => {
      const baseTransition: { duration: number; ease?: readonly [number, number, number, number] } = reduced
        ? { duration: 0 }
        : { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const };
      return {
        next: {
          hidden: { opacity: 0, x: -24, transition: baseTransition },
          visible: { opacity: 1, x: 0, transition: baseTransition },
        },
        prev: {
          hidden: { opacity: 0, x: 24, transition: baseTransition },
          visible: { opacity: 1, x: 0, transition: baseTransition },
        },
        zoom: {
          hidden: { opacity: 0, scale: 0.93, transition: baseTransition },
          visible: { opacity: 1, scale: 1, transition: baseTransition },
        },
        fade: {
          hidden: { opacity: 0, y: 6, transition: baseTransition },
          visible: { opacity: 1, y: 0, transition: baseTransition },
        },
      };
    },
    [reduced],
  );

  const rowVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.012, duration: cellDuration, ease: cellEase },
      },
    }),
    [cellDuration],
  );

  const cellVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 4 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: cellDuration, ease: cellEase },
      },
    }),
    [cellDuration],
  );

  // ── Day Cell Component ─────────────────

  function MonthCell({
    date,
    dayPlans,
    cellFocused,
  }: {
    date: string;
    dayPlans: WeeklyPlanItem[];
    cellFocused: boolean;
  }) {
    const cellEl = useRef<HTMLButtonElement>(null);
    const [mx, setMx] = useState(0.5);
    const [my, setMy] = useState(0.5);
    const [tiltX, setTiltX] = useState(0);
    const [tiltY, setTiltY] = useState(0);
    const cur = isCurrentMonth(date);
    const sel = isSelected(date);
    const td = isToday(date);
    const dayNumber = parseInt(date.slice(8, 10), 10);
    const hov = hoverDate === date;
    const total = dayPlans.length;
    const done = dayPlans.filter((p) => Boolean(p.completedAt)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const chipZ = hov ? 14 : 0;
    const tiltZ = hov && !isMobile ? 18 : 0;

    const pointerRaf = useRef(0);

    const setCellRef = useCallback((el: HTMLButtonElement | null) => {
      cellEl.current = el;
      if (el) cellRefs.current.set(date, el);
      else cellRefs.current.delete(date);
    }, [date]);

    const cellPointerMove = useCallback(
      (e: React.PointerEvent<HTMLButtonElement>) => {
        if (reduced || e.pointerType !== "mouse" || isMobile) return;
        cancelAnimationFrame(pointerRaf.current);
        pointerRaf.current = requestAnimationFrame(() => {
          const rect = cellEl.current!.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
          const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
          setMx(x);
          setMy(y);
          setTiltX((y - 0.5) * 6);
          setTiltY((x - 0.5) * 6);
        });
      },
      [reduced, isMobile],
    );

    const handlePointerEnter = useCallback(() => {
      if (!reduced && !isMobile) setHoverDate(date);
    }, [date, reduced, isMobile]);
    const handlePointerLeave = useCallback(() => {
      setHoverDate(null);
      setTiltX(0);
      setTiltY(0);
    }, []);

    const monthName = formatLocalDate(date, { month: "long" });
    const ariaDone =
      done === 0 ? "sem concluídos" : done === 1 ? "1 concluído" : `${done} concluídos`;
    const ariaTotal = total === 0 ? "sem planos" : total === 1 ? "1 plano" : `${total} planos`;
    const ariaLabel = `${dayNumber} de ${monthName}, ${ariaTotal}, ${ariaDone}${td ? ", hoje" : ""}`;

    const numColor = sel
      ? "text-[var(--accent)]"
      : td
        ? "text-[var(--accent)]"
        : !cur
          ? "text-[var(--text-faint)]"
          : "text-[var(--text)]";

    const baseClasses = `mv-cell relative flex flex-col items-start gap-1.5 p-2 min-w-0 overflow-hidden rounded-xl transition-[background_color,border_color,box_shadow] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2`;

    const modClasses = [
      hov ? "mv-cell--hover" : "",
      td && sel ? "mv-cell--today-selected" : td ? "mv-cell--today" : "",
      sel && !td ? "mv-cell--selected" : "",
      !cur ? "mv-cell--adjacent" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const showQuickAdd = !total && (isMobile || hov);

    const chips = dayPlans
      .slice(0, chipLimit > 0 ? chipLimit : 0)
      .map((p) => {
        const completed = Boolean(p.completedAt);
        const color = p.color || p.category.color;
        const title = p.title || "(sem título)";
        return (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDateSelect(date);
            }}
            aria-label={completed ? `Concluído: ${title}` : title}
            className={`mv-chip ${completed ? "mv-chip--completed" : ""} transition-colors`}
            title={title}
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <span className="mv-chip-dot" aria-hidden="true" />
            <span className="mv-chip-title">{title}</span>
          </button>
        );
      });

    const dots = dayPlans.slice(0, 3).map((p) => {
      const completed = Boolean(p.completedAt);
      const color = p.color || p.category.color;
      return (
        <span
          key={p.id}
          className="mv-dot"
          style={{ backgroundColor: completed ? "var(--text-muted)" : color, opacity: completed ? 0.45 : 1 }}
          aria-hidden="true"
        />
      );
    });

    return (
      <motion.button
        role="gridcell"
        type="button"
        aria-label={ariaLabel}
        aria-selected={sel ? true : undefined}
        aria-current={td ? "date" : undefined}
        tabIndex={cellFocused ? 0 : -1}
        ref={setCellRef}
        onPointerMove={cellPointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        variants={cellVariants}
        initial="hidden"
        animate="visible"
        className={`${baseClasses} ${modClasses} mv-preserve-3d`}
        onClick={(e) => handleCellClick(e, date, cur)}
        style={
          {
            "--mv-mx": mx,
            "--mv-my": my,
            "--mv-tilt-x": `${tiltX}deg`,
            "--mv-tilt-y": `${tiltY}deg`,
            "--mv-tilt-z": `${tiltZ}px`,
            "--mv-chip-z": `${chipZ}px`,
            transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(${tiltZ}px)`,
          } as React.CSSProperties
        }
      >
        <div className="mv-cell-inner flex flex-col items-start gap-1.5 w-full">
          <div className="w-full flex items-start justify-between gap-1">
            <span className={`mv-number font-mono tabular-nums font-bold text-[11px] leading-none ${numColor}`}>
              {dayNumber}
            </span>
            {showQuickAdd && onPlanCreate && (
              <button
                type="button"
                aria-label={`Adicionar plano para ${dayNumber} de ${monthName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlanCreate(date);
                }}
                className="mv-quick-add"
              >
                <Plus size={10} aria-hidden="true" />
              </button>
            )}
          </div>
          {hov && <div className="mv-pointer-light" aria-hidden="true" />}
          {!isMobile && (
            <div className="mv-chips flex flex-row gap-1" style={{ transform: `translateZ(${chipZ}px)` }}>
              {chips}
              {total > (chipLimit > 0 ? chipLimit : 0) && (
                <span
                  ref={pillRef}
                  role="button"
                  tabIndex={0}
                  aria-label={`+${total - chipLimit} mais planos em ${dayNumber} de ${monthName}`}
                  onClick={(e) => openPopover(e, date)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPopover(e, date);
                    }
                  }}
                  className="mv-pill"
                >
                  +{total - chipLimit} mais
                </span>
              )}
            </div>
          )}
          {isMobile && (
            <div className="mv-dots flex flex-row gap-1">
              {dots}
              {total > 3 && <span className="mv-dot-more text-[10px] font-bold text-[var(--text-faint)]">+{total - 3}</span>}
            </div>
          )}
          {!isMobile && total > 0 && (
            <div className="mv-workload" title={`${done} de ${total} concluídos`} aria-hidden="true">
              <motion.div
                className="mv-workload-fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          )}
        </div>
      </motion.button>
    );
  }

  // ── Rows and Grid ─────────────────

  const rows: string[][] = [];
  for (let r = 0; r < rowCount; r++) rows.push(days.slice(r * 7, (r + 1) * 7));

  return (
    <div
      role="grid"
      aria-label={`Calendário — ${monthLabel}`}
      aria-multiselectable="false"
      className="space-y-1"
      onKeyDown={handleGridKeyDown}
    >
      {/* Weekday header row - aligned with day number alignment */}
      <div className="grid grid-cols-7 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
        {SHORT_WEEKDAYS.map((name) => (
          <div key={name} className="mv-weekday px-3 py-2 text-center">
            {name}
          </div>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={monthKey}
          ref={gridRef}
          className="mv-panel mv-rows-wrap mv-perspective rounded-xl overflow-hidden"
          variants={navVariantsMemo}
          initial={false} // Skip initial animation for page transitions
          animate={navDirection ? navDirection : "fade"}
          exit={navDirection ?? undefined}
          transition={{ duration: reduced ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] as const }}
        >
          {rows.map((week, r) => (
            <motion.div
              key={r}
              role="row"
              aria-label={`Semana ${r + 1} de ${rowCount}`}
              className="grid grid-cols-7 gap-px"
              variants={rowVariants as unknown as Variants}
              initial="hidden"
              animate="visible"
              style={{ minHeight: `${MIN_ROW_HEIGHT.desktop}px` }}
            >
              {week.map((date, c) => {
                const dayPlans = (plansByDate.get(date) ?? []).slice().sort(
                  (a, b) => (a.title || "").localeCompare(b.title || ""),
                );
                return (
                  <MonthCell
                    key={date}
                    date={date}
                    dayPlans={dayPlans}
                    cellFocused={selectedIdx >= 0 && r * 7 + c === selectedIdx}
                  />
                );
              })}
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {visiblePopover && (
        <DayPopover
          date={visiblePopover.date}
          plans={(plansByDate.get(visiblePopover.date) ?? []).slice().sort(
            (a, b) => (a.title || "").localeCompare(b.title || ""),
          )}
          position={{ left: visiblePopover.left, top: visiblePopover.top }}
          onClose={closePopover}
          onDaySelect={onDateSelect}
          onToggleCompleted={onToggleCompleted}
          onDelete={onDelete}
          today={today}
          reduced={Boolean(reduced)}
          containerRef={popoverEl}
        />
      )}
    </div>
  );
}

// ── Day Popover (glass style) ─────────────────

function DayPopover({
  date,
  plans,
  position,
  onClose,
  onDaySelect,
  onToggleCompleted,
  onDelete,
  today,
  reduced,
  containerRef,
}: {
  date: string;
  plans: WeeklyPlanItem[];
  position: { left: number; top: number };
  onClose: () => void;
  onDaySelect: (date: string) => void;
  onToggleCompleted?: (id: number, completed: boolean) => void;
  onDelete?: (id: number) => void;
  today: string;
  reduced: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const total = plans.length;
  const done = plans.filter((p) => Boolean(p.completedAt)).length;
  const label = formatLocalDate(date, { weekday: "long", day: "numeric", month: "long" });
  const isTodayPop = date === today;

  return createPortal(
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Planos de ${label}`}
      style={{ left: position.left, top: position.top }}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="mv-popover fixed z-50 w-[270px] max-w-[90vw] rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[20px] backdrop-saturate-[140%] shadow-[var(--glass-shadow)] text-left overflow-hidden"
    >
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text)] leading-none">
              {label}{isTodayPop ? " · hoje" : ""}
            </p>
            <p className="text-[10px] text-[var(--text-faint)] leading-none">
              {total} plano{total !== 1 ? "s" : ""} · {done} concluído{done !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-white/[0.10] hover:text-[var(--text)] transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-1">
          {plans.length === 0 ? (
            <p className="text-[11px] text-[var(--text-faint)] px-2">Sem planos neste dia</p>
          ) : (
            plans.map((p) => (
              <div key={p.id} className="group relative">
                <TaskCard
                  plan={p}
                  onToggle={(completed) => {
                    onToggleCompleted?.(p.id, completed);
                    onClose();
                  }}
                  onDelete={() => {
                    onDelete?.(p.id);
                    onClose();
                  }}
                  alwaysVisible
                />
              </div>
            ))
          )}
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDaySelect(date);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-transparent bg-[var(--accent-bg)] px-3 py-2 text-[12px] font-medium text-[var(--accent)] shadow-[0_0_16px_rgba(113,212,255,.25)] hover:bg-[var(--accent-bg)] hover:shadow-[0_0_24px_rgba(113,212,255,.35)] transition-[background_color,box-shadow] duration-150"
          >
            Abrir dia <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}