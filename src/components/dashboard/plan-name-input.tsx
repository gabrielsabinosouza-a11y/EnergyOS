"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { PLAN_NAME_MAX } from "@/lib/daily-limits";

/** Re-export so client components can import from the component file. */
export { PLAN_NAME_MAX };

// ── Pure helpers (exported for unit testing) ──────────────────────────────

/**
 * Sanitizes pasted text: replaces line breaks with a single space and trims
 * edges. This is important because the plan name is a single-line field but
 * users may paste from multi-line sources (notes, emails, etc.).
 */
export function sanitizePastedText(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

export type CounterState = "neutral" | "caution" | "error";

/**
 * Returns the counter visual state based on character count vs the soft limit.
 * Uses 80% as the caution threshold (amber) and >limit as error (red).
 */
export function getCounterState(length: number, max: number = PLAN_NAME_MAX): CounterState {
  if (length > max) return "error";
  if (length >= max * 0.8) return "caution";
  return "neutral";
}

/** Returns how many characters are left before the soft limit. */
export function getRemaining(length: number, max: number = PLAN_NAME_MAX): number {
  return Math.max(0, max - length);
}

// ── Component ───────────────────────────────────────────────────────────

export interface PlanNameInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** Controlled value — the component never truncates. */
  value: string;
  /** Receives the new value (always the full, untruncated text). */
  onChange: (value: string) => void;
  /** Plan color used for the LED border (e.g. "#71d4ff"). Defaults to cyan. */
  color?: string;
  labelText?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PlanNameInput({
  value,
  onChange,
  color = "var(--accent)",
  labelText = "NOME DA ATIVIDADE",
  placeholder = "Ex.: Ir à igreja, Treino, Estudar...",
  autoFocus = false,
  id,
  onKeyDown,
  ...rest
}: PlanNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = id ?? `plan-name-${generatedId}`;
  const counterId = `${inputId}-counter`;
  const helperId = `${inputId}-helper`;
  const liveId = `${inputId}-live`;

  const [isComposing, setIsComposing] = useState(false);
  const [showClear, setShowClear] = useState(false);

  // Animation pause: tab hidden
  const [tabHidden, setTabHidden] = useState(false);

  // Animation pause: element off-screen (IntersectionObserver)
  const [onScreen, setOnScreen] = useState(true);

  const reduced = useReducedMotion();

  const counterState = getCounterState(value.length);
  const isOverLimit = counterState === "error";
  const remaining = getRemaining(value.length);

  // Show the clear button when there is text and not composing
  useEffect(() => {
    setShowClear(value.length > 0 && !isComposing);
  }, [value, isComposing]);

  // ── Tab visibility listener (pauses LED rotation) ─────────────────────
  useEffect(() => {
    if (!("hidden" in document)) return;
    function onVisibility() {
      setTabHidden(document.hidden);
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── Intersection Observer (pauses LED rotation when off-screen) ────────
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

  const animationPaused = !onScreen || tabHidden || reduced;

  // ── Accessibility live region: announce only at 80% and 100% thresholds ─
  const liveThresholdRef = useRef<"none" | "caution" | "error">("none");
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    const len = value.length;
    const max = PLAN_NAME_MAX;

    if (len > max) {
      if (liveThresholdRef.current !== "error") {
        liveThresholdRef.current = "error";
        setLiveMessage("Limite de caracteres excedido. Coloque os detalhes na nota.");
      }
      return;
    }
    if (len >= max * 0.8) {
      if (liveThresholdRef.current !== "caution") {
        liveThresholdRef.current = "caution";
        setLiveMessage(`Faltam ${remaining} caracteres.`);
      }
      return;
    }
    // Below 80%: reset threshold so next ascent triggers announcement again
    if (liveThresholdRef.current !== "none") {
      liveThresholdRef.current = "none";
    }
  }, [value, remaining]);

  // ── Paste: sanitize line breaks, no truncation ──────────────────────────
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text/plain");
    const sanitized = sanitizePastedText(pasted);

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

    // Restore caret position after the next paint
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

  // ── Dynamic classes ────────────────────────────────────────────────────
  const counterClassName =
    counterState === "error"
      ? "text-[var(--red)]"
      : counterState === "caution"
        ? "text-[var(--orange)]"
        : "text-[var(--text-faint)]";

  const inputClassName = `
    plan-name-input
    w-full
    rounded-xl
    border-0
    bg-[var(--bg-tertiary)]
    text-[var(--text)]
    placeholder-[var(--text-muted)]
    font-inherit
    text-base
    outline-none
  `;

  return (
    <div className="plan-name-input-root">
      {/* Label */}
      <label htmlFor={inputId} className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {labelText}
      </label>

      {/* Input wrapper with LED border */}
      <div
        className={`plan-input-led relative flex items-center ${animationPaused ? "paused" : ""} ${isOverLimit ? "plan-input-led--error" : ""}`}
        style={{ "--plan-color": color } as CSSProperties}
      >
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
          className={inputClassName}
          placeholder={placeholder}
        />

        {/* Clear button (32×32, fades in when text exists) */}
        {reduced ? (
          <button
            type="button"
            aria-label="Limpar"
            onClick={handleClear}
            className="plan-input-clear"
          >
            <X size={14} />
          </button>
        ) : (
          <AnimatePresence>
            {showClear && (
              <motion.button
                type="button"
                aria-label="Limpar"
                onClick={handleClear}
                className="plan-input-clear"
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
        )}
      </div>

      {/* Reserved meta row: counter (right) + error helper (left) — no layout shift */}
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
