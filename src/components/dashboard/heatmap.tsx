"use client";

import type { ActivityDay } from "@/lib/activity";
import { ConsistencyHeatmap } from "./consistency-heatmap";

interface HeatmapProps {
  year: number;
  days: ActivityDay[];
  today: string;
}

/** Adapta o mapa anual para a grade compartilhada da página Consistência. */
export function Heatmap({ year, days, today }: HeatmapProps) {
  return <ConsistencyHeatmap year={year} days={days} today={today} variant="year" />;
}
