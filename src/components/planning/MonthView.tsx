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
  /** Altura da barra de ferramentas do cabeçalho (px), medida pela página. */
  headerHeight?: number;
  /** Entrada com stagger só na primeira vez que o mês é montado. */
  firstMount?: boolean;
  /** Direção da transição de página para este montamento ("next" | "prev" | "zoom"). */
  navDirection?: "next" | "prev" | "zoom" | null;
}

const MIN_ROW_HEIGHT = { desktop: 96, tablet: 70, mobile: 52 };
const CHIP_PITCH = 18;
const CELL_OVERHEAD = 32; // padding + número + barra de carga
const HEADER_OVERHEAD = 82; // painel + toolbar + rótulos de dias da semana
const POPOVER_WIDTH = 270;
const POPBOTTOM_PAD = 320;

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
  headerHeight,
  firstMount = false,
  navDirection = null,
}: MonthViewProps) {
  const reduced = useReducedMotion();
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
    // Completa apenas a última semana (4, 5 ou 6 linhas no total).
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
  const [adjacentDir, setAdjacentDir] = useState<"next" | "prev">("next");

  const selectedIdx = days.indexOf(selectedDate);
  const visiblePopover = popover && isCurrentMonth(popover.date) ? popover : null;

  const isMobile = sizeMode === "mobile";
  const isTablet = sizeMode === "tablet";
  const minRow = isMobile ? MIN_ROW_HEIGHT.mobile : isTablet ? MIN_ROW_HEIGHT.tablet : MIN_ROW_HEIGHT.desktop;
  const chipCap = isMobile ? 0 : isTablet ? 2 : 3;
  const containerHeight = headerHeight ? `calc(100dvh - ${headerHeight}px - ${HEADER_OVERHEAD}px)` : "100vh";

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

  // Mede a altura da grade para decidir quantos chips cabem em cada célula
  // (sem hardcode; todas as células de uma linha têm a mesma altura).
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const box = entry.borderBoxSize?.[0];
      const h = box ? box.blockSize : entry.contentRect.height;
      const cellH = Math.max(1, h / rowCount);
      const avail = cellH - CELL_OVERHEAD;
      let n = Math.floor(avail / CHIP_PITCH);
      if (chipCap === 0) n = 0;
      else n = Math.max(1, Math.min(chipCap, n));
      setChipLimit(n);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowCount, chipCap, isMobile]);

  // Fecha o popover ao mudar de mês (derivado durante o render, sem effect).

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
        setAdjacentDir(date < monthRange.start ? "prev" : "next");
        onMonthNavigate?.(date);
        return;
      }
      onDateSelect(date);
    },
    [onDateSelect, onMonthNavigate, monthRange.start],
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

  const closePopover = useCallback(() => setPopover(null), []);

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

  // ── Variantes de movimento (apenas transform/opacity) ──────────────────

  const monthLabel = formatLocalDate(monthRange.start, { month: "long", year: "numeric" }); // "outubro de 2026"

  const navVariantsMemo: Variants = useMemo(() => {
    const baseTransition: { duration: number; ease?: readonly [number, number, number, number] } = reduced
      ? { duration: 0 }
      : { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };
    const withStagger = (base: typeof baseTransition) => ({ ...base, staggerChildren: rowStagger });
    return {
      next: {
        hidden: { rotateY: -14, translateX: -24, opacity: 0, transition: withStagger(baseTransition) },
        visible: { rotateY: 0, translateX: 0, opacity: 1, transition: withStagger(baseTransition) },
      },
      prev: {
        hidden: { rotateY: 14, translateX: 24, opacity: 0, transition: withStagger(baseTransition) },
        visible: { rotateY: 0, translateX: 0, opacity: 1, transition: withStagger(baseTransition) },
      },
      zoom: {
        hidden: { scale: 0.93, opacity: 0, transition: withStagger(baseTransition) },
        visible: { scale: 1, opacity: 1, transition: withStagger(baseTransition) },
      },
    };
  }, [reduced, rowStagger]);

  const cellDuration = reduced ? 0 : 0.28;
  const rowStagger = firstMount && !reduced ? 0.025 : 0;
  const cellStagger = firstMount && !reduced ? 0.012 : 0;

  const rowVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: cellStagger, duration: cellDuration, ease: cellEase },
      },
    }),
    [rowStagger, cellStagger, cellDuration],
  );

  const cellVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration: cellDuration, ease: cellEase },
      },
    }),
    [cellDuration],
  );

  // ── Célula do dia ──────────────────────────────────────────────────────

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
    const tiltZ = hov ? 18 : 0;

    const pointerRaf = useRef(0);

    const setCellRef = useCallback((el: HTMLButtonElement | null) => {
      cellEl.current = el;
      if (el) cellRefs.current.set(date, el);
      else cellRefs.current.delete(date);
    }, [date]);

    const cellPointerMove = useCallback(
      (e: React.PointerEvent<HTMLButtonElement>) => {
        if (reduced || e.pointerType !== "mouse") return;
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
      [reduced],
    );

    const handlePointerEnter = useCallback(() => {
      if (!reduced) setHoverDate(date);
    }, [reduced, date]);
    const handlePointerLeave = useCallback(() => {
      setHoverDate(null);
      setTiltX(0);
      setTiltY(0);
    }, [date]);

    const monthName = formatLocalDate(date, { month: "long" });
    const ariaDone =
      done === 0 ? "sem concluídos" : done === 1 ? "1 concluído" : `${done} concluídos`;
    const ariaTotal = total === 0 ? "sem planos" : total === 1 ? "1 plano" : `${total} planos`;
    const ariaLabel = `${dayNumber} de ${monthName}, ${ariaTotal}, ${ariaDone}${td ? ", hoje" : ""}`;

    const numColor = sel
      ? "text-[var(--accent)]"
      : td
        ? "text-[var(--text)]"
        : !cur
          ? "text-[var(--text-faint)]"
          : "text-[var(--text)]";
    const baseClasses = `mv-cell relative flex flex-col items-start gap-1.5 p-1.5 min-w-0 overflow-hidden border border-transparent rounded-[8px] text-left cursor-pointer transition-[background_color,border_color,box-shadow] duration-150 ease-out hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 focus-visible:shadow-[0_0_0_4px_rgba(113,212,255,.20)]`;
    const modClasses = [hov ? "mv-cell--hover" : "", td ? "mv-cell--today" : "", sel ? "mv-cell--selected" : "", !cur ? "opacity-50" : ""]
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
            className={`inline-flex items-center gap-1.5 min-w-[1px] truncate rounded-md border px-2 py-1 text-[10px] font-medium leading-none hover:bg-white/[0.06] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 ${
              completed
                ? "border-[var(--text-muted)]/40 bg-white/[0.02] line-through opacity-60"
                : "border-transparent"
            }`}
            style={{ borderLeft: `3px solid ${color}`, color: completed ? "var(--text-muted)" : "var(--text)" }}
            title={title}
          >
            <span className="w-1.5 h-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="min-w-0 truncate">{title}</span>
          </button>
        );
      });

    const dots = dayPlans.slice(0, 3).map((p) => {
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
        initial={false}
        animate="visible"
        className={`${baseClasses} ${modClasses}`}
        onClick={(e) => handleCellClick(e, date, cur)}
      >
        <div
          className="mv-cell-inner flex flex-col items-start gap-1.5 w-full"
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
          <div className="w-full flex items-start justify-between gap-1 pt-0.5">
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
          {td && (
            <>
              <div className="mv-today-bar" aria-hidden="true" />
              <span className="mv-today-dot" aria-hidden="true" />
            </>
          )}
          {!isMobile ? (
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
        ) : (
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
      <AnimatePresence mode="popLayout">
        <motion.div
          key={monthKey}
          ref={gridRef}
          className="mv-panel mv-rows-wrap mv-perspective rounded-xl"
          style={{ height: containerHeight, minHeight: `${Math.max(1, minRow * rowCount + 32)}px` }}
          variants={navVariantsMemo}
          initial={firstMount ? false : "hidden"}
          animate={
            firstMount
              ? { opacity: 1, transition: { duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] as const } }
              : (navDirection ?? adjacentDir)
          }
          exit={navDirection ?? adjacentDir}
          transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] as const }}
        >
          {/* Rótulos dos dias da semana (alinhados com os números, à esquerda). */}
          <div className="grid grid-cols-7 gap-[1px]">
            {SHORT_WEEKDAYS.map((name) => (
              <div key={name} className="mv-weekday px-1.5 py-1.5" aria-hidden="true">
                {name}
              </div>
            ))}
          </div>
          {rows.map((week, r) => (
            <motion.div
              key={r}
              className="grid grid-cols-7 gap-[1px] mv-preserve-3d"
              variants={rowVariants}
              initial={false}
              animate="visible"
            >
              {week.map((date, c) => {
                const dayPlans = (plansByDate.get(date) ?? []).slice().sort(
                  (a, b) => (a.title || "").localeCompare(b.title || ""),
                );
                return <MonthCell key={date} date={date} dayPlans={dayPlans} cellFocused={selectedIdx >= 0 && r * 7 + c === selectedIdx} />;
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
          today={today}
          reduced={reduced}
        />
      )}
    </div>
  );
}
