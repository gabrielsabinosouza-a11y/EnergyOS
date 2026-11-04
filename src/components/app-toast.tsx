"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { APP_TOAST_EVENT, navigateToActiveFocus } from "@/lib/focus-conflict";

interface AppToastAction {
  label: string;
  url?: string;
}

interface AppToastData {
  title: string;
  description?: string;
  variant?: "info" | "success" | "error";
  action?: AppToastAction;
  /** Auto-dismiss delay in ms (defaults to 7000). */
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 7000;

/**
 * App-wide action toast — the shared notification renderer.
 *
 * Consumes the `energyosToast` CustomEvent (already dispatched by reminder
 * handling in `src/lib/notifications.ts` and by the focus-conflict helper in
 * `src/lib/focus-conflict.ts`) and renders a friendly banner with a title, an
 * optional description, and an optional action button. Action buttons reuse
 * the existing `Button`/`toast` visual language (`--accent`, `.panel`, safe-
 * area-aware placement) and respect `prefers-reduced-motion`.
 */
export function AppToast() {
  const [toast, setToast] = useState<AppToastData | null>(null);
  const reduced = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<AppToastData>).detail;
      if (!detail || typeof detail.title !== "string") return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(detail);
      timerRef.current = setTimeout(dismiss, detail.durationMs ?? DEFAULT_DURATION_MS);
    };
    window.addEventListener(APP_TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, onToast as EventListener);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  const handleAction = useCallback(
    (action: AppToastAction) => {
      // The focus action scrolls to (or opens) the live session instead of
      // navigating away — same destination as an anchor link, but instant
      // when the card is already on screen.
      if (action.label === "Voltar para o foco") {
        navigateToActiveFocus();
      } else if (action.url) {
        window.location.assign(action.url);
      }
      dismiss();
    },
    [dismiss],
  );

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: reduced ? 0 : 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduced ? 0 : 8 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          className="panel fixed left-1/2 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 p-4 shadow-[0_18px_44px_-20px_rgba(0,0,0,.7)] sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 32%, var(--border))" }}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--text)]">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {toast.description}
                </p>
              )}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => handleAction(toast.action!)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[var(--bg-primary)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{ background: "var(--accent)" }}
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={dismiss}
              className="shrink-0 rounded-full p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
