"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const LS_KEY = "energyos:store-seen";
const SEEN_EVENT = "energyos:store-seen";

function readLocalSeen(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Persists "user has visited /loja" — optimistic local update, server sync via
 * PATCH /api/settings (punctual update, doesn't touch other preferences), and
 * an event so every mounted hook instance hides the dot immediately.
 */
export function markStoreSeen(): void {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(SEEN_EVENT));
  void api.updateStoreNotificationSeen(true).catch(() => {});
  window.dispatchEvent(new Event("energyos:settings-changed"));
}

/**
 * Returns whether the store notification was already seen.
 * - `null` while loading → callers must render the dot ONLY on explicit false.
 * - localStorage short-circuits repeat visits on the same browser.
 * - Server flag keeps it dismissed across devices/sessions.
 */
export function useStoreSeen(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      if (readLocalSeen()) {
        if (active) setSeen(true);
        return;
      }
      try {
        const s = await api.getSettings();
        if (active) setSeen(s.storeNotificationSeen === true);
      } catch {
        // Guests / API failure: keep null → dot stays hidden (safe default).
      }
    };
    void boot();
    const onSeen = () => setSeen(true);
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => {
      active = false;
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, []);

  return seen;
}
