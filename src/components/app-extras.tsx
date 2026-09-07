"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { UserSettings } from "@/types";
import { registerServiceWorker, watchInstallPrompt } from "@/lib/sw-register";
import { startReminders, stopReminders, type ReminderConfig } from "@/lib/reminders";
import { OnboardingTour } from "./onboarding-tour";

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
 * App-wide PWA plumbing: registers the service worker, captures the browser's
 * install prompt, and runs the daily reminder scheduler off the user's saved
 * settings. Re-applies whenever the settings change (custom event fired by the
 * settings page) or when the tab regains visibility (catch scheduling that
 * slipped past while the device slept / tab was hidden).
 */
export function AppExtras() {
  const { user, loading } = useAuth();

  useEffect(() => {
    registerServiceWorker();
    watchInstallPrompt();
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

  return <OnboardingTour />;
}