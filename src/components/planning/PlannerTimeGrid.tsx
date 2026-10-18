"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HOUR_HEIGHT, layoutTimedEvents, toMinutes } from "@/lib/planning/time";
import { EventBlock } from "./EventBlock";
import type { WeeklyPlanItem } from "@/types";
import { planItemKey } from "./PlanRow";

export interface TimeGridDay {
  date: string;
  today: boolean;
  selected: boolean;
  /** Eventos timed (com horário) do dia, ordenados por início. */
  events: WeeklyPlanItem[];
}

interface PlannerTimeGridProps {
  days: TimeGridDay[];
  onSlotClick: (date: string, minutes: number) => void;
  onEventClick?: (plan: WeeklyPlanItem) => void;
}

/**
 * Grade de timeline compartilhada (Semana com 7 colunas / Dia com 1).
 * Scroll interno, linhas de hora, blocos posicionados, linha do "agora".
 */
export function PlannerTimeGrid({ days, onSlotClick, onEventClick }: PlannerTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Atualiza a linha do "agora" a cada minuto.
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-scroll para a hora atual no mount (timeline aberta na hora certa).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const targetMinutes = now.getHours() * 60 + now.getMinutes() - 60;
    el.scrollTop = Math.max(0, (targetMinutes / 60) * HOUR_HEIGHT);
  }, []);

  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const canvasHeight = 24 * HOUR_HEIGHT;

  return (
    <div className="planner-timeline flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="planner-timeline-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="planner-timeline-canvas relative" style={{ height: canvasHeight }}>
          {/* Linhas horizontais de hora. */}
          {hourLabels.map((h) => (
            <div
              key={`line-${h}`}
              className="planner-hour-line absolute left-0 right-0 border-t border-[var(--border-subtle)]"
              style={{ top: h * HOUR_HEIGHT }}
            />
          ))}

          <div className="grid h-full" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
            {/* Gutter com rótulos das horas. */}
            <div className="planner-gutter relative" style={{ height: canvasHeight }}>
              {hourLabels.map((h) => (
                <span
                  key={`g-${h}`}
                  className="planner-gutter-hour absolute right-1.5 -translate-y-1/2"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  {String(h).padStart(2, "0")}
                </span>
              ))}
            </div>

            {/* Colunas dos dias. */}
            {days.map((day) => (
              <DayColumn key={day.date} day={day} onSlotClick={onSlotClick} onEventClick={onEventClick} nowMinutes={nowMinutes} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DayColumnProps {
  day: TimeGridDay;
  onSlotClick: (date: string, minutes: number) => void;
  onEventClick?: (plan: WeeklyPlanItem) => void;
  nowMinutes: number;
}

function DayColumn({ day, onSlotClick, onEventClick, nowMinutes }: DayColumnProps) {
  const events = useMemo(() => {
    const list = day.events
      .map((p) => {
        const start = toMinutes(p.startTime);
        const end = toMinutes(p.endTime) ?? (start != null && p.durationMinutes ? start + p.durationMinutes : null);
        if (start == null || end == null || end <= start) return null;
        return { id: planItemKey(p), start, end, plan: p };
      })
      .filter((x): x is { id: string; start: number; end: number; plan: WeeklyPlanItem } => x !== null);
    const map = layoutTimedEvents(list);
    return list
      .map((e) => ({ plan: e.plan, layout: map.get(e.id)! }))
      .filter((x) => x.layout);
  }, [day.events]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 60 / 30) * 30;
    onSlotClick(day.date, Math.max(0, Math.min(23 * 60 + 30, minutes)));
  };

  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  return (
    <div
      className={`planner-day-col relative min-h-0${day.selected ? " planner-day-col--selected" : ""}`}
      style={{ height: 24 * HOUR_HEIGHT }}
      onClick={handleClick}
    >
      {events.map(({ plan, layout }) => (
        <EventBlock key={planItemKey(plan)} plan={plan} layout={layout} onClick={() => onEventClick?.(plan)} />
      ))}

      {day.today ? (
        <div className="planner-now-line" style={{ top: nowTop }}>
          <div className="planner-now-dot" style={{ top: nowTop }} />
        </div>
      ) : null}
    </div>
  );
}
