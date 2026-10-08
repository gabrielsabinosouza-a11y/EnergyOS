"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { activityLevel, type ActivityDay } from "@/lib/activity";
import { buildConsistencyWeeks } from "@/lib/consistency-calendar";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const SHORT_WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const GAP = 3;

export interface ConsistencyHeatmapProps {
  days: ActivityDay[];
  year: number;
  today: string;
  accent?: string;
  variant?: "year" | "habit";
  summary?: string;
  streakDates?: string[];
  onSelectDay?: (day: ActivityDay) => void;
}

interface HeatCellProps {
  day: ActivityDay | null;
  level: number;
  isToday: boolean;
  isStreak: boolean;
  accent: string;
  tabStop: boolean;
  onFocusDate: (date: string) => void;
  onSelect: (day: ActivityDay) => void;
}

const HeatCell = memo(function HeatCell({ day, level, isToday, isStreak, accent, tabStop, onFocusDate, onSelect }: HeatCellProps) {
  const date = day?.date ?? "";
  const label = day ? describeDay(day, level) : "";
  return (
    <button
      type="button"
      role="gridcell"
      tabIndex={day && tabStop ? 0 : -1}
      disabled={!day}
      aria-label={label}
      title={label}
      onClick={() => day && onSelect(day)}
      onFocus={() => day && onFocusDate(day.date)}
      onKeyDown={(event) => {
        const move = event.key === "ArrowRight" ? 7 : event.key === "ArrowLeft" ? -7 : event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!move) return;
        event.preventDefault();
        const cells = event.currentTarget.closest("[role=grid]")?.querySelectorAll<HTMLButtonElement>("[role=gridcell]:not(:disabled)");
        if (!cells?.length) return;
        const current = Array.from(cells).indexOf(event.currentTarget);
        cells[Math.max(0, Math.min(cells.length - 1, current + move))]?.focus();
      }}
      className={`consistency-heat-cell relative aspect-square min-w-0 rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-white/90 ${isToday ? "consistency-heat-today" : ""} ${isStreak ? "consistency-heat-streak" : ""}`}
      style={{
        "--heat-color": accent,
        "--heat-level": level,
        "--heat-intensity": level === 0 ? 0 : level / 4,
        "--heat-streak": isStreak ? 0.32 : 0,
        backgroundColor: day ? `var(--heat-${level})` : "transparent",
        cursor: day ? "pointer" : "default",
      } as React.CSSProperties}
      data-date={date}
    />
  );
});

function describeDay(day: ActivityDay, level: number) {
  const [year, month, date] = day.date.split("-").map(Number);
  const weekday = WEEKDAYS[(new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7].toLowerCase();
  const completions = day.dailyTaskCompletions ?? day.goalLogs ?? 0;
  const detail = day.future
    ? "ainda vai acontecer"
    : [day.checkin === "success" ? "check-in feito" : day.checkin === "protected" ? "sequência protegida" : "", completions ? `${completions} hábito${completions === 1 ? "" : "s"} concluído${completions === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "sem atividade";
  return `${weekday}, ${date} de ${MONTHS[month - 1].toLowerCase()} ${year} — ${detail}; nível ${level} de 4`;
}

export function ConsistencyHeatmap({ days, year, today, accent = "#71d4ff", variant = "year", summary, streakDates = [], onSelectDay }: ConsistencyHeatmapProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ActivityDay | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const isHabit = variant === "habit";
  const columns = useMemo(() => buildConsistencyWeeks(year, days, today), [days, today, year]);
  const totalCells = columns.length * 7;
  const firstDate = columns.flat().find((day) => day !== null)?.date;
  const tabStopDate = focusedDate ?? (today.startsWith(`${year}-`) ? today : firstDate);
  const streakDateSet = useMemo(() => new Set(streakDates), [streakDates]);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const cellSize = Math.max(11, (viewportWidth - (columns.length - 1) * GAP) / columns.length);
  useEffect(() => {
    if (scrollRef.current && scrollRef.current.scrollWidth > scrollRef.current.clientWidth) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [cellSize, columns.length]);
  const weekStarts = useMemo(() => {
    const starts = new Set<number>();
    columns.forEach((column, weekIndex) => {
      if (column.some((day) => day?.date.endsWith("-01"))) starts.add(weekIndex);
    });
    return starts;
  }, [columns]);
  const monthLabels = useMemo(() => {
    const labels: { month: number; column: number }[] = [];
    for (let month = 0; month < 12; month += 1) {
      const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const column = columns.findIndex((week) => week.some((day) => day?.date === first));
      if (column < 0) continue;
      // Place labels over the week containing the 1st; omit labels that cannot
      // fit without colliding with the previous month label.
      if (labels.length && column - labels[labels.length - 1].column < 4) continue;
      labels.push({ month, column });
    }
    return labels;
  }, [columns, year]);

  const selectDay = useCallback((day: ActivityDay) => {
    setSelected(day);
    onSelectDay?.(day);
  }, [onSelectDay]);
  const showTooltip = useCallback((event: React.SyntheticEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-date]");
    const tooltip = tooltipRef.current;
    const host = scrollRef.current;
    if (!target || !tooltip || !host || target.dataset.date === "") return;
    tooltip.textContent = target.getAttribute("aria-label") ?? "";
    tooltip.hidden = false;
    const targetRect = target.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(hostRect.width - tooltip.offsetWidth - 8, targetRect.left - hostRect.left + targetRect.width / 2 - tooltip.offsetWidth / 2))}px`;
    tooltip.style.top = `${Math.max(0, targetRect.top - hostRect.top - tooltip.offsetHeight - 8)}px`;
  }, []);
  const hideTooltip = useCallback(() => { if (tooltipRef.current) tooltipRef.current.hidden = true; }, []);

  const gridStyle = { "--heat-color": accent, "--heat-count": columns.length, "--heat-gap": `${GAP}px`, "--heat-cell-size": `${cellSize}px` } as React.CSSProperties;
  const gridColumnsStyle = { gridTemplateColumns: `repeat(${columns.length}, ${cellSize}px)`, minWidth: `max(100%, ${columns.length * cellSize + (columns.length - 1) * GAP}px)` } as React.CSSProperties;
  const monthHeaderStyle = { ...gridColumnsStyle, gridTemplateRows: "1fr" } as React.CSSProperties;
  const activeCount = days.filter((day) => !day.future && activityLevel(day) > 0).length;
  const summaryText = summary ?? `${activeCount} ${isHabit ? "dias com check-in" : `dias ativos em ${year}`}`;

  return (
    <div className={`consistency-heatmap ${isHabit ? "consistency-heatmap-habit" : "consistency-heatmap-year"}`} style={gridStyle}>
      <div className="consistency-heatmap-body">
        <div className="consistency-weekday-labels" aria-hidden="true">
          <span className="consistency-weekday-spacer" />
          {WEEKDAYS.map((label, i) => <span key={`${label}-${i}`} title={label}>{isHabit ? SHORT_WEEKDAYS[i] : label}</span>)}
        </div>
        <div ref={scrollRef} className="consistency-heatmap-scroll" onPointerOver={showTooltip} onPointerOut={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideTooltip(); }} onFocus={showTooltip} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideTooltip(); }}>
          <div className="consistency-heatmap-content" style={gridColumnsStyle}>
            <div className="consistency-month-row" style={monthHeaderStyle} aria-hidden="true">
              {columns.map((_, index) => {
                const label = monthLabels.find((item) => item.column === index);
                return <div key={index} className="relative min-w-0">{label && <span className="consistency-month-label">{MONTHS[label.month]}</span>}</div>;
              })}
            </div>
            <div className="consistency-heatmap-grid" role="grid" aria-label={`Atividade diária em ${year}`} style={gridColumnsStyle}>
              {columns.map((column, weekIndex) => (
                <motion.div key={column[0]?.date ?? `week-${weekIndex}`} className={`consistency-heatmap-week ${weekStarts.has(weekIndex) ? "consistency-month-divider" : ""}`} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reduceMotion ? 0 : weekIndex * 0.006 }}>
                  {column.map((day, rowIndex) => {
                    const activity = day && !day.future ? activityLevel(day) : 0;
                    const level = activity === 0 ? 0 : activity === 1 ? 1 : activity === 2 ? 3 : 4;
                    return <HeatCell key={day?.date ?? `empty-${weekIndex}-${rowIndex}`} day={day} level={level} isToday={day?.date === today} isStreak={Boolean(day && streakDateSet.has(day.date))} accent={accent} tabStop={day?.date === tabStopDate} onFocusDate={setFocusedDate} onSelect={selectDay} />;
                  })}
                </motion.div>
              ))}
            </div>
          </div>
          <div ref={tooltipRef} className="consistency-heat-tooltip" role="tooltip" hidden />
        </div>
      </div>
      <div className="consistency-heatmap-footer">
        <p className="text-[11px] text-[var(--text-muted)]">{summaryText}<span className="sr-only">. Navegue pelas células com as setas do teclado.</span></p>
        <div className="consistency-heat-legend" aria-label="Legenda: menos atividade a mais atividade"><span>Menos</span>{[0, 1, 2, 3, 4].map((level) => <span key={level} className="consistency-heat-legend-cell" style={{ backgroundColor: `var(--heat-${level})` }} />)}<span>Mais</span></div>
      </div>
      <AnimatePresence mode="wait">
        {selected && <motion.div key={selected.date} className="consistency-selected-day" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
          <span>{describeDay(selected, activityLevel(selected))}</span>
          <button type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhe do dia">×</button>
        </motion.div>}
      </AnimatePresence>
      <span className="sr-only">Grade com {totalCells} posições, semanas em colunas e dias da semana de segunda a domingo.</span>
    </div>
  );
}

export function activityDayFromHabit(date: string, completed: boolean, today: string): ActivityDay {
  return { date, checkin: null, dailyTaskCompletions: completed ? 1 : 0, future: date > today };
}
