"use client";

/**
 * PWA plumbing: registers the service worker so the offline shell and the
 * local-reminder notification channel work. The UI intentionally does not
 * capture `beforeinstallprompt` anymore (native apps ship as "em breve"), but
 * the manifest is still served so Chrome/Android can still offer
 * "Add to Home screen" from their own menu.
 */

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Deliberately after first paint; never blocks the LCP or dev reload.
  try {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  } catch { /* unsupported/insecure context */ }
}