"use client";

import { activityCurrentStreakDates, type ActivityDay } from "@/lib/activity";
import { ConsistencyHeatmap } from "./consistency-heatmap";

interface HeatmapProps {
  year: number;
  days: ActivityDay[];
  today: string;
}

/** Adapta o mapa anual para a grade compartilhada da página Consistência. */
export function Heatmap({ year, days, today }: HeatmapProps) {
  const endpoint = today < `${year}-01-01` ? `${year}-01-01` : today > `${year}-12-31` ? `${year}-12-31` : today;
  const streakDates = activityCurrentStreakDates(days, endpoint);
  return <ConsistencyHeatmap year={year} days={days} today={today} streakDates={streakDates} variant="year" showLegend />;
}
