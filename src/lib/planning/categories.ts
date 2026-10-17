/**
 * Shared category colors for the planner views (Mês/Semana/Dia).
 * Single source of truth — chips, blocks and side panels all resolve colors here.
 */

import type { WeeklyPlanItem } from "@/types";

/** Fallback palette when the plan/category has no color. */
export const FALLBACK_EVENT_COLORS = [
  "#71d4ff", // cyan (accent)
  "#b69cff", // purple
  "#4ade80", // green
  "#ffb86b", // orange
  "#f87171", // red
];

/** Cor do evento: plan.color > category.color > fallback estável por id. */
export function eventColor(plan: WeeklyPlanItem): string {
  const c = plan.color || plan.category?.color;
  if (typeof c === "string" && c.trim() !== "") return c;
  // Fallback estável por id do plano (evita mutação de estado entre renders).
  const idx = (plan.id ?? 0) % FALLBACK_EVENT_COLORS.length;
  return FALLBACK_EVENT_COLORS[idx];
}

/** Rótulo curto da hora ("14:30") para tooltips, ou string vazia. */
export function shortTimeLabel(plan: WeeklyPlanItem): string {
  if (!plan.startTime) return "";
  const parts = plan.startTime.split(":").map((p) => Number.parseInt(p, 10));
  const h = parts[0];
  const m = parts[1] ?? 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
