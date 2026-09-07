"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { AchievementProgress, UserSettings } from "@/types";
import { registerServiceWorker } from "@/lib/sw-register";
import { startReminders, stopReminders, type ReminderConfig } from "@/lib/reminders";
import { OnboardingTour } from "./onboarding-tour";
import { AchievementUnlockModal } from "./achievement-unlock-modal";

function toReminderConfig(s: UserSettings): ReminderConfig {
  return {
    notificationsEnabled: s.notificationsEnabled,
    soundNotificationsEnabled: s.soundNotificationsEnabled,
    checkinEnabled: s.reminderCheckinEnabled,
    focusEnabled: s.reminderFocusEnabled,
    sleepEnabled: s.reminderSleepEnabled,
    focusTime: s.focusTime,
    sleepTime: s.sleepTime,
  };
}

/**
 * Watches for achievements that were just unlocked on the server and surfaces
 * them one at a time in a celebratory modal, marking each as seen on close.
 */
function useAchievementUnlocks(active: boolean) {
  const [current, setCurrent] = useState<AchievementProgress | null>(null);
  const currentRef = useRef<AchievementProgress | null>(null);
  const queueRef = useRef<AchievementProgress[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const consume = (achievements: AchievementProgress[]) => {
      if (cancelled) return;
      const fresh = achievements.filter((a) => a.justUnlocked);
      const shownIds = new Set(queueRef.current.map((q) => q.id));
      if (currentRef.current) shownIds.add(currentRef.current.id);
      const additions = fresh.filter((a) => !shownIds.has(a.id));
      if (additions.length === 0) return;
      if (!currentRef.current) {
        currentRef.current = additions[0];
        queueRef.current = additions.slice(1);
        setCurrent(additions[0]);
      } else {
        queueRef.current = [...queueRef.current, ...additions];
      }
    };

    api
      .getAchievements()
      .then(({ achievements }) => consume(achievements))
      .catch(() => {});

    const onVisible = () => {
      if (document.hidden) return;
      api
        .getAchievements()
        .then(({ achievements }) => consume(achievements))
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [active]);

  const dismiss = useCallback(() => {
    const dismissed = currentRef.current;
    currentRef.current = queueRef.current[0] ?? null;
    queueRef.current = queueRef.current.slice(1);
    setCurrent(currentRef.current);
    if (dismissed) {
      void api.markAchievementSeen(dismissed.id).catch(() => {});
    }
  }, []);

  return { current, dismiss };
}

/**
 * App-wide PWA plumbing: registers the service worker, captures the browser's
 * install prompt, and runs the daily reminder scheduler off the user's saved
 * settings. Re-applies whenever the settings change (custom event fired by the
 * settings page) or when the tab regains visibility (catch scheduling that
 * slipped past while the device slept / tab was hidden).
 */
export function AppExtras() {
  const { user, loading } = useAuth();
  const { current, dismiss } = useAchievementUnlocks(!!user && !loading);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    let mounted = true;

    async function apply() {
      try {
        const s = await api.getSettings();
        if (mounted) startReminders(toReminderConfig(s));
      } catch { /* silent — reminders are best-effort */ }
    }

    void apply();
    const onVisible = () => { if (!document.hidden) void apply(); };
    const onChanged = () => void apply();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("energyos:settings-changed", onChanged);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("energyos:settings-changed", onChanged);
      stopReminders();
    };
  }, [user, loading]);

  return (
    <>
      <OnboardingTour />
      <AchievementUnlockModal achievement={current} onClose={dismiss} />
    </>
  );
}