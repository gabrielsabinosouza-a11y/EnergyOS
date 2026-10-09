"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Tag as TagIcon } from "lucide-react";
import { PLAN_NAME_MAX } from "@/lib/daily-limits";
import type { CSSProperties, InputHTMLAttributes } from "react";

/** Re-export so client components can import from the component file. */
export { PLAN_NAME_MAX };

/**
 * Glass-morphism input card for the weekly planner pop-up menu.
 *
 * Replaces the bare `PlanNameInput` (`led={false}` variant) inside the
 * `WeeklyPlanModal` so the name/tag field is always clearly tappable and
 * visually distinct. The card provides:
 *
 *  - glass + blur + shadow container (see `.weekly-plan-input-card` in globals.css)
 *  - a `#`-tag accent that turns cyan the moment the value starts with `#`
 *  - a character counter with caution/error states
 *  - an animated clear button
 *  - live-region announcements for screen readers
 *  - a 1.5px LED border ring (conic-gradient on the plan colour, border-only so
 *    it never touches the fill/text) that dims at rest, brightens on hover and
 *    rotates faster + glows on focus, and freezes when the tab is hidden, the
 *    field scrolls off-screen, or the user prefers reduced motion
 *
 * Unlike `PlanNameInput`, the LED ring is border-only (masked to the 1.5px
 * border, fully transparent in the centre) so it cannot obscure the input text
 * or caret, which avoids the focus/visibility edge-cases that made the old raw
 * render hard to interact with.
 */

// ── Pure helpers (exported for unit testing) ──────────────────────────────

/** Sanitizes pasted text: replaces line breaks with a single space and trims. */
export function sanitizeTagText(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

export type CounterState = "neutral" | "caution" | "error";

/** Counter visual state based on character count vs the soft limit. */
export function getCounterState(length: number, max: number = PLAN_NAME_MAX): CounterState {
  if (length > max) return "error";
  if (length >= max * 0.8) return "caution";
  return "neutral";
}

/** Returns how many characters are left before the soft limit. */
export function getRemaining(length: number, max: number = PLAN_NAME_MAX): number {
  return Math.max(0, max - length);
}

/** Returns true when the text value represents a tag (starts with `#`). */
export function isTagValue(value: string): boolean {
  return value.startsWith("#");
}

// ── Component ───────────────────────────────────────────────────────────────

export interface WeeklyPlanInputCardProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size" | "color"> {
  /** Controlled value — the component never truncates. */
  value: string;
  /** Receives the new value (always the full, untruncated text). */
  onChange: (value: string) => void;
  /** Accent color used for focus glow and the tag icon. Defaults to cyan. */
  color?: string;
  labelText?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function WeeklyPlanInputCard({
  value,
  onChange,
  color = "var(--accent)",
  labelText = "NOME / TAG",
  placeholder = "Ex.: Ir à igreja, #trabalho, Treino...",
  autoFocus = false,
  onKeyDown,
  id,
  ...rest
}: WeeklyPlanInputCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = id ?? `wp-input-${generatedId}`;
  const counterId = `${inputId}-counter`;
  const helperId = `${inputId}-helper`;
  const liveId = `${inputId}-live`;

  const [isComposing, setIsComposing] = useState(false);
  const reduced = useReducedMotion();

  // Pause the LED ring animation when the tab is hidden (saves CPU/battery).
  const [tabHidden, setTabHidden] = useState(false);

  // Pause the LED ring animation when the input scrolls off-screen.
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    if (!("hidden" in document)) return;
    function onVisibility() {
      setTabHidden(document.hidden);
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = inputRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setOnScreen(entries[0]?.isIntersecting ?? false);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  // The ring rotates and glows while the input is visible, focused or hovered;
  // it is frozen (paused) when the tab is hidden, the field is off-screen, or
  // the user prefers reduced motion.
  const animationPaused = !onScreen || tabHidden || reduced;

  const counterState = getCounterState(value.length);
  const isOverLimit = counterState === "error";
  const remaining = getRemaining(value.length);
  const showClear = value.length > 0 && !isComposing;
  const isTag = isTagValue(value);

  // ── Accessibility live region: announce at 80 % and 100 % thresholds ─────
  const liveThresholdRef = useRef<"none" | "caution" | "error">("none");
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    if (value.length > PLAN_NAME_MAX) {
      if (liveThresholdRef.current !== "error") {
        liveThresholdRef.current = "error";
        setLiveMessage("Limite de caracteres excedido. Coloque os detalhes na nota.");
      }
      return;
    }
    if (value.length >= PLAN_NAME_MAX * 0.8) {
      if (liveThresholdRef.current !== "caution") {
        liveThresholdRef.current = "caution";
        setLiveMessage(`Faltam ${remaining} caracteres.`);
      }
      return;
    }
    if (liveThresholdRef.current !== "none") {
      liveThresholdRef.current = "none";
    }
  }, [value, remaining]);

  // ── Paste: sanitize line breaks, no truncation ──────────────────────────
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text/plain");
    const sanitized = sanitizeTagText(pasted);

    if (sanitized === pasted) return; // nothing to sanitize, let browser handle normally

    e.preventDefault();
    const input = inputRef.current;
    if (!input) {
      onChange(sanitized);
      return;
    }

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const newValue = value.slice(0, start) + sanitized + value.slice(end);
    onChange(newValue);

    const newPos = start + sanitized.length;
    requestAnimationFrame(() => {
      input.setSelectionRange(newPos, newPos);
    });
  }

  // ── Clear button ────────────────────────────────────────────────────────
  function handleClear() {
    onChange("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // ── Keydown forwarding ──────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
  }

  // ── Dynamic classes ─────────────────────────────────────────────────────
  const counterClassName =
    counterState === "error"
      ? "text-[var(--red)]"
      : counterState === "caution"
        ? "text-[var(--orange)]"
        : "text-[var(--text-faint)]";

  return (
    <div className="weekly-plan-input-card-root">
      {/* Label */}
      <label
        htmlFor={inputId}
        className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]"
      >
        {labelText}
      </label>

      {/* Glass card wrapper — red border + shake when over the limit, LED ring pauses when off-screen/hidden */}
      <motion.div
        className={`weekly-plan-input-card ${isOverLimit ? "weekly-plan-input-card--error" : ""} ${animationPaused ? "paused" : ""}`}
        style={{ "--wp-accent": color } as CSSProperties}
      >
        {/* Tag icon prefix — accent when the value starts with `#` */}
        <TagIcon
          size={15}
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 ${isTag ? "text-[var(--wp-accent)]" : "text-[var(--text-faint)]"}`}
          aria-hidden="true"
        />

        <input
          {...rest}
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="sentences"
          spellCheck
          enterKeyHint="done"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onPaste={handlePaste}
          aria-invalid={isOverLimit || undefined}
          aria-describedby={`${counterId} ${helperId}`}
          aria-errormessage={isOverLimit ? helperId : undefined}
          className="weekly-plan-input-card-input"
          placeholder={placeholder}
          title={value || undefined}
        />

        {/* Clear button (fades in when text exists) */}
        {!reduced ? (
          <AnimatePresence>
            {showClear && (
              <motion.button
                type="button"
                aria-label="Limpar"
                onClick={handleClear}
                className="weekly-plan-input-card-clear"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        ) : showClear ? (
          <button type="button" aria-label="Limpar" onClick={handleClear} className="weekly-plan-input-card-clear">
            <X size={14} />
          </button>
        ) : null}
      </motion.div>

      {/* Reserved meta row: error helper (left) + counter (right) — no layout shift */}
      <div
        id={counterId}
        className="mt-2 flex min-h-5 items-end justify-between text-xs"
      >
        <span id={helperId} className="text-[var(--red)] min-h-[20px]">
          {isOverLimit ? "Use até 120 caracteres. Coloque os detalhes na nota." : ""}
        </span>

        <span
          className={`font-mono tabular-nums min-w-[3ch] text-right ${counterClassName}`}
          aria-label={
            isOverLimit
              ? `Limite excedido: ${value.length} de ${PLAN_NAME_MAX} caracteres`
              : `${value.length} de ${PLAN_NAME_MAX} caracteres`
          }
        >
          {value.length}/{PLAN_NAME_MAX}
        </span>
      </div>

      {/* Polite live region (visually hidden) */}
      <div id={liveId} aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
    </div>
  );
}
