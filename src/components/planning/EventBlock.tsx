"use client";

import { memo } from "react";
import { eventColor } from "@/lib/planning/categories";
import type { WeeklyPlanItem } from "@/types";

export interface EventBlockLayout {
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  lanes: number;
}

interface EventBlockProps {
  plan: WeeklyPlanItem;
  layout: EventBlockLayout;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Bloco posicionado de evento na timeline (Semana/Dia).
 * top/height derivados da hora de início/fim; eventos sobrepostos
 * lado a lado via lanes (leftPct/widthPct).
 */
export const EventBlock = memo(function EventBlock({ plan, layout, onClick }: EventBlockProps) {
  const color = eventColor(plan);
  const title = plan.title || "(sem título)";
  const minutes = plan.startTime
    ? Number.parseInt(plan.startTime.split(":")[0], 10) * 60 + Number.parseInt(plan.startTime.split(":")[1] ?? "0", 10)
    : 0;
  const endMinutes = plan.endTime
    ? Number.parseInt(plan.endTime.split(":")[0], 10) * 60 + Number.parseInt(plan.endTime.split(":")[1] ?? "0", 10)
    : minutes + 60;
  const timeLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} – ${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  const completed = Boolean(plan.completedAt);
  const tooSmall = layout.height < 30;

  return (
    <button
      type="button"
      className="event-block"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        top: layout.top,
        height: layout.height,
        left: `calc(${(layout.leftPct) * 100}% + 2px)`,
        width: `calc(${(layout.widthPct) * 100}% - 4px)`,
        backgroundColor: completed
          ? "var(--bg-tertiary)"
          : "color-mix(in srgb, var(--bg-primary) 78%, transparent)",
        borderLeft: `3px solid ${color}`,
        opacity: completed ? 0.6 : 1,
      }}
      aria-label={completed ? `Concluído: ${title}` : title}
    >
      <span className="event-block__title">{title}</span>
      {!tooSmall ? <span className="event-block__time">{timeLabel}</span> : null}
    </button>
  );
});
