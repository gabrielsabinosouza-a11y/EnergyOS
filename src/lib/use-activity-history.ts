"use client";

import { useCallback, useEffect, useState } from "react";
import type { StreakDayStatus } from "@/types";
import { api } from "./api-client";
import {
  activityStats,
  buildActivityYear,
  type ActivityDay,
  type ActivityStats,
} from "./activity";
import { getYearRange, todayIso } from "./db/dates";

export interface ActivityHistoryState {
  days: ActivityDay[];
  stats: ActivityStats;
  /** Endpoint usado nas sequências: hoje (ano atual) ou 31/12 do ano. */
  endpoint: string;
  loading: boolean;
  error: string;
  reload: () => void;
}

const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

/**
 * Histórico de atividade de um ano: check-ins (12 requisições ao
 * streak-calendar) + goal_logs (1 intervalo). Falha parcial degrada para a
 * fonte ausente; erro global só quando as duas fontes falham.
 */
export function useActivityHistory(year: number): ActivityHistoryState {
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    current: 0,
    best: 0,
    activeDays: 0,
    goalLogEntries: 0,
    elapsedDays: 0,
    rate: 0,
  });
  const [endpoint, setEndpoint] = useState(() => todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      setError("");
      try {
        const { start, end } = getYearRange(year);
        const today = todayIso();
        const [checkinResults, goalLogsResult] = await Promise.all([
          Promise.allSettled(MONTHS.map((month) => api.getStreakCalendar(year, month))),
          Promise.allSettled([api.getGoalLogs(start, end)]),
        ]);

        if (cancelled) return;

        const checkins: Record<string, StreakDayStatus> = {};
        let checkinsOk = 0;
        for (const result of checkinResults) {
          if (result.status !== "fulfilled") continue;
          checkinsOk += 1;
          for (const [date, status] of Object.entries(result.value.days)) {
            checkins[date] = status;
          }
        }

        const goalLogCounts: Record<string, number> = {};
        const logsOutcome = goalLogsResult[0];
        if (logsOutcome?.status === "fulfilled") {
          for (const log of logsOutcome.value.logs) {
            goalLogCounts[log.date] = (goalLogCounts[log.date] ?? 0) + 1;
          }
        }

        const logsOk = logsOutcome?.status === "fulfilled";
        if (checkinsOk === 0 && !logsOk) {
          throw new Error("Não foi possível carregar o histórico de atividade.");
        }

        const yearDays = buildActivityYear(year, { checkins, goalLogCounts, today });
        const yearEnd = `${year}-12-31`;
        const effectiveEndpoint = today > yearEnd ? yearEnd : today < start ? start : today;

        setDays(yearDays);
        setStats(activityStats(yearDays, effectiveEndpoint));
        setEndpoint(effectiveEndpoint);
      } catch (err) {
        if (cancelled) return;
        setDays([]);
        setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [year, reloadKey]);

  return { days, stats, endpoint, loading, error, reload };
}
