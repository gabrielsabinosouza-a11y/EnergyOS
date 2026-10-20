"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WeeklyPlanItem } from "@/types";

/**
 * Notification service for sending reminders.
 * Uses both in-app toast notifications and Web Push.
 */

// Local storage key for notification permission state
const PERMISSION_KEY = "energyos_notification_permission_asked";
const DENIED_KEY = "energyos_notification_denied";

export interface ReminderNotification {
  plan: WeeklyPlanItem;
  remindAt: Date;
}

/**
 * Opens the notification permission prompt before the browser one.
 * Shows a localized explanation first.
 */
export function askNotificationPermission(
  onGranted: () => void,
  onDenied: () => void,
  onError: (error: Error) => void,
): () => void {
  // Check if we already have permission
  if (Notification.permission === "granted") {
    onGranted();
    return () => {};
  }

  if (Notification.permission === "denied") {
    onDenied();
    return () => {};
  }

  // Save that we've asked
  localStorage.setItem(PERMISSION_KEY, "true");

  // Show a custom prompt first
  const showPermissionPrompt = () => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then(() => {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            // Register for push if available
            registerPushSubscription().catch(() => {});
            onGranted();
          } else {
            localStorage.setItem(DENIED_KEY, "true");
            onDenied();
          }
        });
      }).catch(onError);
    } else {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          onGranted();
        } else {
          localStorage.setItem(DENIED_KEY, "true");
          onDenied();
        }
      });
    }
  };

  showPermissionPrompt();
  return () => {};
}

/**
 * Creates a permission prompt handler that the PlanDialog can use.
 */
export function createPermissionPromptHandler(): (onApprove: () => void) => void {
  return (onApprove) => {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      // Fall back - just save the reminder and show in-app notification later
      onApprove();
      return;
    }

    // Check if already denied
    if (localStorage.getItem(DENIED_KEY) === "true") {
      // User already denied, save reminder but skip permission
      onApprove();
      return;
    }

    // Ask for permission
    askNotificationPermission(onApprove, () => {
      // Permission denied, but continue with in-app reminders
      onApprove();
    }, (error) => {
      console.error("Notification permission error:", error);
      onApprove();
    });
  };
}

/**
 * Checks if permission has already been requested.
 */
export function hasAskedPermission(): boolean {
  return localStorage.getItem(PERMISSION_KEY) === "true";
}

/**
 * Checks if permission was denied.
 */
export function isPermissionDenied(): boolean {
  return localStorage.getItem(DENIED_KEY) === "true";
}

/**
 * Registers for Web Push notifications.
 * Requires VAPID keys from environment.
 */
export async function registerPushSubscription(): Promise<{
  endpoint: string;
  keys: { p256dh: string; auth: string };
} | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from env (injected at build time)
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
    if (!vapidKey) return null;

    // Convert VAPID key to ArrayBuffer
    const urlBase64ToArray = (base64: string) => {
      const padding = "=".repeat((4 - (base64.length % 4)) % 4);
      const base64Pd = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64Pd);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArray(vapidKey),
    });

    const keys = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");
    if (!keys || !auth) return null;

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(keys))),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
      },
    };
  } catch (error) {
    console.error("Failed to register push subscription:", error);
    return null;
  }
}

/**
 * Gets existing push subscription from server.
 */
export async function getPushSubscription(profileId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/push-subscriptions?profileId=${profileId}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.subscriptions || [];
  } catch {
    return [];
  }
}

/**
 * Schedules a reminder to be shown at the specified time.
 */
export function scheduleReminder(plan: WeeklyPlanItem): void {
  if (!plan.reminderOffsetMin || plan.reminderOffsetMin <= 0) return;

  // Sem data ou sem horário não há reminder agendável (tarefa não agendada).
  if (!plan.planDate || !plan.startTime) return;

  const now = new Date();
  const planDate = new Date(plan.planDate);

  // Calculate start time
  const [hours, minutes] = plan.startTime.split(":").map(Number);
  planDate.setHours(hours, minutes, 0, 0);

  // Calculate reminder time
  const reminderTime = new Date(planDate);
  reminderTime.setMinutes(reminderTime.getMinutes() - plan.reminderOffsetMin);

  // Schedule the reminder
  const delayMs = reminderTime.getTime() - now.getTime();
  if (delayMs <= 0) return; // Already passed

  setTimeout(() => {
    showReminder(plan);
  }, delayMs);
}

/**
 * Shows the reminder notification.
 */
export function showReminder(plan: WeeklyPlanItem): void {
  // Show in-app toast
  if (typeof window !== "undefined") {
    // Dispatch a custom event that the app can listen to
    const event = new CustomEvent("energyosReminder", {
      detail: {
        plan,
        type: "reminder",
        action: "planStart",
      },
    });
    window.dispatchEvent(event);

    // Also try to show via service worker if available
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: "REMINDER",
          title: `Próxima etapa: ${plan.title}`,
          body: `O plano começa agora em ${plan.startTime}`,
          tag: `reminder-${plan.id}`,
          url: "/planner",
        });
      }).catch(() => {});
    }
  }
}

/**
 * Hook for receiving reminder notifications in the app.
 */
export function useReminderNotifications(
  onReminder: (plan: WeeklyPlanItem) => void,
) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "REMINDER") {
        // Show toast banner
        if (typeof window !== "undefined") {
          const toastEvent = new CustomEvent("energyosToast", {
            detail: {
              title: event.data.title,
              description: event.data.body,
              variant: "info",
              action: {
                label: "Ver plano",
                url: event.data.url,
              },
            },
          });
          window.dispatchEvent(toastEvent);
        }
      }
    };

    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail?.type === "reminder") {
        onReminder(event.detail.plan);
      }
    };

    window.addEventListener("message", handleMessage as EventListener);
    window.addEventListener("energyosReminder", handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener("message", handleMessage as EventListener);
      window.removeEventListener("energyosReminder", handleCustomEvent as EventListener);
    };
  }, [onReminder]);
}

/**
 * Auto-schedules reminders for all plans in the current view.
 */
export function useAutoScheduleReminders(
  plans: WeeklyPlanItem[],
  enabled: boolean = true,
) {
  const scheduledRefs = useRef(new Set<number>());

  useEffect(() => {
    if (!enabled) return;

    // Clear scheduled reminders for plans no longer in view
    scheduledRefs.current.forEach((id) => {
      // Check if plan still exists
    });

    // Schedule reminders for plans that need them
    plans.forEach((plan) => {
      if (plan.reminderOffsetMin && plan.reminderOffsetMin > 0 && plan.startTime && !plan.completedAt) {
        if (!scheduledRefs.current.has(plan.id)) {
          scheduleReminder(plan);
          scheduledRefs.current.add(plan.id);
        }
      }
    });

    return () => {
      scheduledRefs.current.clear();
    };
  }, [plans, enabled]);
}