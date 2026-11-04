/**
 * Focus conflict UX helpers (client-only).
 *
 * The backend returns HTTP `409 Conflict` when a user tries to start a second
 * Focus session while one is already active (`startFocusSession` in
 * `src/lib/db/focus.ts` throws `ConflictError`; the route maps it via
 * `handleRoute`). This module is the single frontend choke point for that
 * case: it detects the 409 on the error object produced by `api-client` and
 * surfaces the friendly "Sessão de foco em andamento" alert through the
 * shared app toast — never as a generic error, and never twice in quick
 * succession when parallel requests come back with 409.
 */

export const FOCUS_CONFLICT_TITLE = "Sessão de foco em andamento";
export const FOCUS_CONFLICT_DESCRIPTION =
  "Você já tem uma sessão de foco ativa. Continue sua sessão atual antes de iniciar outra.";
export const FOCUS_CONFLICT_ACTION_LABEL = "Voltar para o foco";

/** Element id of the focus card on the dashboard (target of the toast action). */
export const FOCUS_CARD_ID = "focus-timer-card";

/** Window event consumed by the shared toast renderer (`src/components/app-toast.tsx`). */
export const APP_TOAST_EVENT = "energyosToast";

/**
 * Minimum interval between two focus-conflict alerts. Simultaneous duplicate
 * requests (double-click, Strict Mode re-runs, parallel tabs) land within
 * this window and must not stack duplicate banners.
 */
export const FOCUS_CONFLICT_DEDUPE_MS = 4000;

let lastFocusConflictAt = 0;

/**
 * True when the error is the "already have an active focus session" 409.
 *
 * Duck-typed on `status` so this module stays decoupled from `api-client`
 * (which owns the `ApiRequestError` class) — callers can safely run it on
 * any thrown error shape.
 */
export function isFocusConflictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: unknown }).status === 409
  );
}

/**
 * Dispatches the friendly focus-conflict toast — at most once per
 * `FOCUS_CONFLICT_DEDUPE_MS` window, so simultaneous duplicate requests
 * cannot stack banners. Returns true when an alert was shown; a no-op that
 * returns false when deduplicated or when called outside the browser.
 */
export function showFocusConflictAlert(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  if (now - lastFocusConflictAt < FOCUS_CONFLICT_DEDUPE_MS) return false;
  lastFocusConflictAt = now;
  window.dispatchEvent(
    new CustomEvent(APP_TOAST_EVENT, {
      detail: {
        title: FOCUS_CONFLICT_TITLE,
        description: FOCUS_CONFLICT_DESCRIPTION,
        variant: "info",
        action: { label: FOCUS_CONFLICT_ACTION_LABEL, url: `/dashboard#${FOCUS_CARD_ID}` },
      },
    }),
  );
  return true;
}

/**
 * Returns the user to the existing active focus session: scrolls to the
 * focus card when it is on screen, otherwise navigates to the dashboard
 * anchor. Backed by the dashboard's hash-scroll effect on mount.
 */
export function navigateToActiveFocus(): void {
  if (typeof window === "undefined") return;
  const el = document.getElementById(FOCUS_CARD_ID);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  window.location.assign(`/dashboard#${FOCUS_CARD_ID}`);
}

/** Test-only hook: clears the dedupe window between assertions. */
export function __resetFocusConflictDedupe(): void {
  lastFocusConflictAt = 0;
}
