import type { DailyCheckin, Metric, Task } from "@/types";
import { upsertAndGetProfile } from "./profiles";
import { listCheckins, averagesForRange } from "./checkins";
import { computeProgress, computeStreak, listTasksByDate, type StreakInfo, type TaskProgress } from "./tasks";
import { generateWeeklyInsights } from "./insights";
import { addDaysIso, todayIso } from "./dates";

export interface DashboardSnapshotResponse {
  user: import("@/types").User;
  tasks: Task[];
  checkins: DailyCheckin[];
  metrics: Metric[];
  insights: import("@/types").Insight[];
  taskProgress: TaskProgress;
  streak: StreakInfo;
}

function trendPercent(current: number | null, previous: number | null): number | undefined {
  if (current === null || previous === null || previous === 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

/** Snapshot completo do dia — todas as métricas calculadas no servidor. */
export async function buildDashboardSnapshot(
  profileId: string,
  displayName?: string,
  email?: string,
  role?: "user" | "admin",
): Promise<DashboardSnapshotResponse> {
  const today = todayIso();
  const weekStart = addDaysIso(today, -6);
  const prevWeekStart = addDaysIso(today, -13);
  const prevWeekEnd = addDaysIso(today, -7);

  const [user, tasks, checkins, avgCurrent, avgPrevious, insights, streak] = await Promise.all([
    upsertAndGetProfile(profileId, displayName, email),
    listTasksByDate(profileId, today),
    listCheckins(profileId, weekStart, today),
    averagesForRange(profileId, weekStart, today),
    averagesForRange(profileId, prevWeekStart, prevWeekEnd),
    generateWeeklyInsights(profileId, today),
    computeStreak(profileId, today),
  ]);

  // Override role from auth to ensure it's current
  if (role) {
    (user as any).role = role;
  }

  const metrics: Metric[] = [
    {
      kind: "sleep",
      label: "Sono",
      value: avgCurrent.sleepHours ?? 0,
      unit: "h",
      trend: trendPercent(avgCurrent.sleepHours, avgPrevious.sleepHours),
      period: "week",
    },
    {
      kind: "study",
      label: "Estudo",
      value: avgCurrent.studyMinutes ?? 0,
      unit: "min",
      trend: trendPercent(avgCurrent.studyMinutes, avgPrevious.studyMinutes),
      period: "week",
    },
    {
      kind: "training",
      label: "Treino",
      value: avgCurrent.trainingMinutes ?? 0,
      unit: "min",
      trend: trendPercent(avgCurrent.trainingMinutes, avgPrevious.trainingMinutes),
      period: "week",
    },
  ];

  return {
    user,
    tasks,
    checkins,
    metrics,
    insights,
    taskProgress: computeProgress(tasks),
    streak,
  };
}
