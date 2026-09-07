"use client";

/**
 * Local (OS-level) reminders for energyOS.
 *
 * Schedules daily push-like notifications from the browser's Notification API
 * and routes them through the service worker channel when available, so they
 * also appear while the app is open but its tab is hidden. Reminders run
 * client-side — they need the app (or installed PWA + service worker) alive;
 * true background push when the app is fully closed would require a push
 * service + VAPID keys, which is out of scope here.
 */

export interface ReminderConfig {
  notificationsEnabled: boolean;
  soundNotificationsEnabled?: boolean;
  checkinEnabled: boolean;
  focusEnabled: boolean;
  sleepEnabled: boolean;
  checkinTime?: string; // "HH:MM"
  focusTime?: string; // "HH:MM"
  sleepTime?: string; // "HH:MM"
}

let timers: ReturnType<typeof setTimeout>[] = [];
let installedListener = false;
let currentCfg: ReminderConfig | null = null;

/** Milliseconds until the next occurrence of an "HH:MM" local wall-clock time. */
function msUntil(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() < now.getTime()) next.setDate(next.getDate() + 1);
  // Guard: in rare DST edge cases the computed delay is past 2^31-1 ms.
  return Math.max(0, Math.min(next.getTime() - now.getTime(), 2 ** 31 - 1000));
}

function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

/** Show an OS notification, preferring the service-worker channel. */
export function osNotify(title: string, body: string, tag: string, url = "/dashboard") {
  if (!canNotify()) return;
  try {
    const payload = { type: "REMINDER", title, body, tag, icon: "/icons_pwa/icon-192.png", url };
    if (navigator.serviceWorker?.controller) {
      void navigator.serviceWorker.controller.postMessage(payload);
    } else if (navigator.serviceWorker) {
      void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(payload));
    } else {
      fallbackNotify(title, body, tag, url);
    }
  } catch {
    fallbackNotify(title, body, tag, url);
  }
}

function fallbackNotify(title: string, body: string, tag: string, url: string) {
  try {
    const n = new Notification(title, { body, tag, icon: "/icons_pwa/icon-192.png", badge: "/icons_pwa/icon-192.png" });
    n.onclick = () => {
      try {
        window.focus();
      } catch { /* ignore */ }
      n.close();
      if (url) window.location.href = url;
    };
  } catch { /* notifications unavailable */ }
}

function scheduleOne(key: "checkinEnabled" | "focusEnabled" | "sleepEnabled", cfg: ReminderConfig) {
  if (!cfg[key] || !cfg.notificationsEnabled) return;
  let hhmm: string | undefined;
  let title = "";
  let body = "";
  let tag = "";
  if (key === "checkinEnabled") {
    hhmm = cfg.checkinTime ?? (cfg.focusTime ?? "09:00");
    title = "Hora do check-in ⚡";
    body = "Registre sono, estudo e energia para manter o ritmo.";
    tag = "reminder-checkin";
  } else if (key === "focusEnabled") {
    hhmm = cfg.focusTime;
    title = "Hora de focar 🎯";
    body = "Seu streak agradece. Inicie uma sessão de foco.";
    tag = "reminder-focus";
  } else {
    hhmm = cfg.sleepTime;
    title = "Hora de dormir 😴";
    body = "Um bom sono alimenta sua energia amanhã.";
    tag = "reminder-sleep";
  }
  if (!hhmm) return;
  const timer = setTimeout(() => {
    osNotify(title, body, tag);
    timers = timers.filter((t) => t !== timer);
    scheduleOne(key, cfg);
  }, msUntil(hhmm));
  timers.push(timer);
}

function scheduleAll(cfg: ReminderConfig) {
  clearReminderTimers();
  scheduleOne("checkinEnabled", cfg);
  scheduleOne("focusEnabled", cfg);
  scheduleOne("sleepEnabled", cfg);
}

function clearReminderTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

/**
 * (Re)start the reminder schedule for the given settings. Safe to call multiple
 * times (e.g. after settings change) — the previous timers are cleared first.
 */
export function startReminders(cfg: ReminderConfig) {
  if (typeof window === "undefined") return;
  currentCfg = cfg;
  scheduleAll(cfg);
  if (!installedListener) {
    installedListener = true;
    // Recompute after the tab was hidden (laptop closed overnight, etc.): any
    // reminder whose wall-clock time slipped past simply moves to tomorrow.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && currentCfg) scheduleAll(currentCfg);
    });
  }
}

export function stopReminders() {
  clearReminderTimers();
}

/** Current Notification permission ("granted" | "denied" | "default"). */
export function notificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "default";
  return Notification.permission;
}

/** Ask the user for notification permission. Must be called from a gesture. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "default";
  try {
    return await Notification.requestPermission();
  } catch {
    return "default";
  }
}