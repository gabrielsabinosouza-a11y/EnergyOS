"use client";

import { memo } from "react";
import { eventColor, shortTimeLabel } from "@/lib/planning/categories";
import type { WeeklyPlanItem } from "@/types";

interface EventChipProps {
  plan: WeeklyPlanItem;
  /** Callback de clique (usado para abrir o popover / selecionar o dia). */
  onClick?: () => void;
  /** Exibe a hora ao lado do título (células do Dia, blocos). */
  showTime?: boolean;
  dimmed?: boolean;
}

/**
 * Chip compacto de evento compartilhado (Mês/Semana/Dia).
 * Uma linha, cor de destaque por categoria, ellipsis e tooltip nativo
 * com título + hora completa. Renderiza como <span> clicável para não
 * aninhar <button> dentro de <button> nas células do mês.
 */
export const EventChip = memo(function EventChip({ plan, onClick, showTime = false, dimmed = false }: EventChipProps) {
  const color = eventColor(plan);
  const title = plan.title || "(sem título)";
  const timeLabel = shortTimeLabel(plan);
  const completed = Boolean(plan.completedAt);

  return (
    <span
      className={`mv-chip${completed ? " mv-chip--completed" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={timeLabel ? `${title} · ${timeLabel}` : title}
      style={{
        backgroundColor: completed ? "var(--bg-tertiary)" : "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
        borderLeft: `3px solid ${color}`,
        color: completed ? "var(--text-muted)" : "var(--text)",
        opacity: dimmed ? 0.55 : 1,
      }}
      role="button"
      tabIndex={-1}
      aria-label={completed ? `Concluído: ${title}` : title}
    >
      <span className="mv-chip__dot" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="mv-chip__title">{title}</span>
      {showTime && timeLabel ? <span className="mv-chip__time">{timeLabel}</span> : null}
    </span>
  );
});
