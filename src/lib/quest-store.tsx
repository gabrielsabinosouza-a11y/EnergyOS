"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MissionMetric, QuestProgressWithQuest } from "@/types";
import { api } from "@/lib/api-client";
import { DAILY_MISSION_LIMIT } from "@/lib/daily-limits";

/**
 * Centralized, reactive daily-quest state.
 *
 * Any component that triggers a quest-relevant action (checking a recurring
 * daily task, completing a focus session, moving a Kanban card to "Feito", ...)
 * calls `applyMetric` to bump the matching missions OPTIMISTICALLY — the
 * progress bar and count update in the same interaction, and the claimable
 * glow state appears the instant a quest reaches its target. The optimistic
 * values are reconciled with server truth via `refresh()` once the action's
 * request returns (server responses are authoritative; a failed request is
 * rolled back by refreshing).
 */

interface MetricUpdate {
  incrementBy?: number;
  setTo?: number;
}

interface QuestsContextValue {
  quests: QuestProgressWithQuest[];
  resetAt: string | null;
  ready: boolean;
  applyMetric: (metric: MissionMetric | string, update?: MetricUpdate) => void;
  replaceQuests: (quests: QuestProgressWithQuest[]) => void;
  markClaimed: (progressId: number) => void;
  refresh: () => Promise<void>;
}

const QuestsContext = createContext<QuestsContextValue | null>(null);

export function DailyQuestsProvider({
  children,
  initialQuests = [],
}: {
  children: React.ReactNode;
  initialQuests?: QuestProgressWithQuest[];
}) {
  const [quests, setQuestsState] = useState<QuestProgressWithQuest[]>(() =>
    initialQuests.slice(0, DAILY_MISSION_LIMIT),
  );
  const [ready, setReady] = useState(initialQuests.length > 0);
  const [resetAt, setResetAt] = useState<string | null>(null);

  const replaceQuests = useCallback((next: QuestProgressWithQuest[]) => {
    setQuestsState(next.slice(0, DAILY_MISSION_LIMIT));
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getDailyQuests();
      replaceQuests(data.quests);
      setResetAt(data.resetAt);
    } catch {
      // Preserve current data during a transient request failure.
    }
  }, [replaceQuests]);

  // Self-fetch only when the host didn't provide initial data (e.g. a page
  // that renders quest-consuming widgets without prefetching).
  useEffect(() => {
    if (initialQuests.length > 0) return;
    let cancelled = false;
    api.getDailyQuests()
      .then((data) => {
        if (!cancelled) {
          replaceQuests(data.quests);
          setResetAt(data.resetAt);
        }
      })
      .catch(() => {
        // A later retry below reconciles transient auth/network failures.
      });
    return () => {
      cancelled = true;
    };
  }, [initialQuests.length, replaceQuests]);

  useEffect(() => {
    if (initialQuests.length > 0 || ready) return;
    let cancelled = false;
    let attempts = 0;
    const retry = async () => {
      attempts += 1;
      try {
        const data = await api.getDailyQuests();
        if (!cancelled) {
          replaceQuests(data.quests);
          setResetAt(data.resetAt);
        }
      } catch {
        if (!cancelled && attempts < 3) setTimeout(retry, attempts * 2000);
      }
    };
    const timer = setTimeout(retry, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initialQuests.length, ready, replaceQuests]);

  const applyMetric = useCallback((metric: MissionMetric | string, update: MetricUpdate = {}) => {
    setQuestsState((prev) =>
      prev.map((q) => {
        if (q.isClaimed || q.isCompleted) return q;
        if ((q.quest.metric ?? "") !== metric) return q;
        const target = q.quest.targetValue;
        const nextValue =
          update.setTo !== undefined
            ? Math.max(q.currentValue, update.setTo)
            : q.currentValue + (update.incrementBy ?? 1);
        const capped = Math.min(nextValue, target);
        const done = capped >= target;
        return {
          ...q,
          currentValue: capped,
          isCompleted: done,
          completedAt: done ? (q.completedAt ?? new Date().toISOString()) : q.completedAt,
        };
      }),
    );
  }, []);

  const markClaimed = useCallback((progressId: number) => {
    setQuestsState((prev) =>
      prev.map((q) =>
        q.id === progressId ? { ...q, isClaimed: true, claimedAt: new Date().toISOString() } : q,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({ quests, resetAt, ready, applyMetric, replaceQuests, markClaimed, refresh }),
    [quests, resetAt, ready, applyMetric, replaceQuests, markClaimed, refresh],
  );

  return <QuestsContext.Provider value={value}>{children}</QuestsContext.Provider>;
}

export function useDailyQuests(): QuestsContextValue {
  const ctx = useContext(QuestsContext);
  if (!ctx) {
    throw new Error("useDailyQuests must be used within <DailyQuestsProvider>");
  }
  return ctx;
}
