"use client";

/**
 * PWA plumbing: registers the service worker and exposes the browser's
 * install prompt so a custom "Instalar" button can ask to add the app.
 *
 * `beforeinstallprompt` is Chrome/Samsung-internet only; iOS/Safari rely on
 * the manifest + apple-touch-icon (used via the layout). Safe no-op elsewhere.
 */

let deferredPrompt: Event | null = null;

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Deliberately after first paint; never blocks the LCP or dev reload.
  try {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  } catch { /* unsupported/insecure context */ }
}

/** Capture the install prompt the first time it fires. */
export function watchInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

/** Whether a deferred install prompt is available to show. */
export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

/** Ask the browser to install the PWA. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt as
    | (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> })
    | null;
  if (!prompt) return false;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === "accepted";
}

/** Reset the captured prompt (e.g. after the user dismissed it). */
export function resetInstallPrompt(): void {
  deferredPrompt = null;
}