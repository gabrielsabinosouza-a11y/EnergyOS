"use client";

import { Minus, Plus } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type WheelEvent,
  type PointerEvent,
} from "react";

/** Hard limits for a habit's daily target (times it must be completed per day). */
export const DAILY_TARGET_MIN = 1;
export const DAILY_TARGET_MAX = 99;

/** One-click preset targets shown as pills under the value. */
export const DAILY_TARGET_PRESETS = [1, 2, 3, 5, 8, 10] as const;

/** Visual pips cap at this count; anything above renders as "+N". */
const PIP_SEGMENTS = 10;

function clamp(value: number): number {
  return Math.max(DAILY_TARGET_MIN, Math.min(DAILY_TARGET_MAX, Math.round(Number(value) || 0)));
}
function pluralWord(count: number): "vez" | "vezes" {
  return count === 1 ? "vez" : "vezes";
}
/** e.g. "3 vezes por dia" — used for aria-valuetext + the polite live region. */
export function formatDailyTarget(count: number): string {
  return `${count} ${pluralWord(count)} por dia`;
}

interface DailyTargetStepperProps {
  /** Committed target value (kept in the modal's habit state). */
  value: number;
  /** Called with the new, clamped target whenever it changes. */
  onChange: (value: number) => void;
  /** Active habit color (the picker's "Cor"); tints the card + LED live. */
  color?: string;
  disabled?: boolean;
}

/**
 * Reusable "Meta diária" control. Used by both the `Editar hábito` and
 * `Novo hábito` modals (they share <HabitModal>).
 *
 * Value is controlled: the parent owns the number and `onChange` is always
 * called with a clamped integer (1–99), so saving & loading behave exactly as
 * before — only the UI surface changed.
 */
export function DailyTargetStepper({ value, onChange, color = "#71d4ff", disabled = false }: DailyTargetStepperProps) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Latest committed value for press-and-hold / wheel / keyboard steps so fast
  // repeats (60ms) never read a stale closure.
  const valueRef = useRef(value);
  valueRef.current = value;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shaking, setShaking] = useState(false);
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const [bumping, setBumping] = useState(false);
  const [ledPulse, setLedPulse] = useState(false);

  const clamped = clamp(value);

  // ── Step callbacks (used by buttons, wheel, keyboard, presets) ───────────
  const pulseLed = useCallback(() => {
    setLedPulse(true);
    setTimeout(() => setLedPulse(false), 560);
  }, []);

  const bump = useCallback(() => {
    setBumping(true);
    setTimeout(() => setBumping(false), 320);
    pulseLed();
  }, [pulseLed]);

  const stepUp = useCallback(() => {
    const v = valueRef.current;
    if (v >= DAILY_TARGET_MAX) { bump(); return; }
    onChange(clamp(v + 1));
    pulseLed();
  }, [onChange, bump, pulseLed]);

  const stepDown = useCallback(() => {
    const v = valueRef.current;
    if (v <= DAILY_TARGET_MIN) { bump(); return; }
    onChange(clamp(v - 1));
    pulseLed();
  }, [onChange, bump, pulseLed]);

  // ── Press-and-hold with acceleration: 400ms → 120ms → 60ms ───────────────
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> | null; held: boolean } | null>(null);
  const startHold = useCallback((fn: () => void) => {
    if (disabled) return;
    clearHold();
    const state = { timer: null as unknown as ReturnType<typeof setTimeout>, interval: null as ReturnType<typeof setInterval> | null, held: false };
    pressRef.current = state;
    state.timer = setTimeout(() => {
      state.held = true;
      fn();
      let idx = 0;
      const delays = [120, 60];
      const tick = () => {
        if (!pressRef.current || !pressRef.current.held) return;
        fn();
        const d = delays[Math.min(idx, delays.length - 1)];
        idx = Math.min(idx + 1, delays.length - 1);
        pressRef.current.interval = setTimeout(tick, d);
      };
      pressRef.current.interval = setTimeout(tick, 120);
    }, 400);
  }, [disabled]);
  const endHold = useCallback((fn: () => void) => {
    const state = pressRef.current;
    if (!state) return;
    clearTimeout(state.timer);
    if (state.interval) clearTimeout(state.interval);
    const wasHeld = state.held;
    pressRef.current = null;
    // Short press (released before the 400ms hold fired) = a single step.
    if (!wasHeld && !disabled) fn();
  }, [disabled]);
  const clearHold = useCallback(() => {
    const state = pressRef.current;
    if (state) {
      clearTimeout(state.timer);
      if (state.interval) clearTimeout(state.interval);
      pressRef.current = null;
    }
  }, []);
  useEffect(() => clearHold, [clearHold]);

  // ── Click-to-edit the number ──────────────────────────────────────────────
  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(String(clamped));
    setEditing(true);
  }, [clamped, disabled]);

  const finishEdit = useCallback((commit: boolean) => {
    if (!commit) { setEditing(false); setDraft(""); return; }
    const raw = Number(draft);
    if (!Number.isFinite(raw) || draft.trim() === "") {
      // Invalid input → simply revert to the committed number.
      setEditing(false); setDraft(""); return;
    }
    const c = clamp(raw);
    const hitMax = raw > DAILY_TARGET_MAX;
    const hitMin = raw < DAILY_TARGET_MIN;
    if (hitMax || hitMin) {
      setDraft(String(c));
      setShaking(true);
      setLimitHint(hitMax ? "Máximo: 99" : "Mínimo: 1");
      onChange(c);
      setTimeout(() => { setShaking(false); setLimitHint(null); setEditing(false); setDraft(String(c)); }, 1100);
    } else {
      onChange(c);
      setEditing(false); setDraft("");
    }
  }, [draft, onChange]);

  // Select-all on focus while editing.
  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    const t = setTimeout(() => {
      el?.focus();
      el?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [editing]);

  // ── Keyboard on the spinbutton (arrows / page / home / end) ───────────────
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        event.preventDefault(); stepUp(); return;
      case "ArrowDown":
      case "ArrowLeft":
        event.preventDefault(); stepDown(); return;
      case "PageUp":
        event.preventDefault(); for (let i = 0; i < 5; i++) stepUp(); return;
      case "PageDown":
        event.preventDefault(); for (let i = 0; i < 5; i++) stepDown(); return;
      case "Home":
        event.preventDefault(); onChange(DAILY_TARGET_MIN); pulseLed(); return;
      case "End":
        event.preventDefault(); onChange(DAILY_TARGET_MAX); pulseLed(); return;
      case "Enter":
        event.preventDefault(); startEdit(); return;
      case " ":
        event.preventDefault(); startEdit(); return;
    }
  };

  // ── Mouse wheel changes the value only while the number is focused ──────
  const onWheel = (event: WheelEvent<HTMLSpanElement>) => {
    if (disabled || document.activeElement !== event.currentTarget) return;
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    if (delta < 0) stepUp();
    else if (delta > 0) stepDown();
  };

  // ── 3D tilt on hover (cursor-following). Disabled on touch / reduced motion ─
  const tiltEnabled = !reduced && !matchMediaCoarse();
  const onCardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!tiltEnabled || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    cardRef.current.style.setProperty("--tilt-x", `${(px - 0.5) * 8}deg`);
    cardRef.current.style.setProperty("--tilt-y", `${(0.5 - py) * 8}deg`);
    cardRef.current.style.setProperty("--glare-x", `${px * 100}%`);
    cardRef.current.style.setProperty("--glare-y", `${py * 100}%`);
  };
  const resetTilt = () => {
    if (!cardRef.current) return;
    cardRef.current.style.removeProperty("--tilt-x");
    cardRef.current.style.removeProperty("--tilt-y");
    cardRef.current.style.removeProperty("--glare-x");
    cardRef.current.style.removeProperty("--glare-y");
  };

  // ── Presets ───────────────────────────────────────────────────────────────
  const selectPreset = (preset: number) => {
    if (disabled) return;
    onChange(clamp(preset));
    pulseLed();
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const unitText = `${pluralWord(clamped)} por dia`;
  const activePreset = DAILY_TARGET_PRESETS.includes(clamped as (typeof DAILY_TARGET_PRESETS)[number]) ? clamped : null;

  return (
    <div
      ref={cardRef}
      className={`habit-dt-perspective w-full ${disabled ? "opacity-60" : ""}`}
      style={{ [`--habit-color` as string]: color }}
      onPointerMove={onCardPointerMove}
      onPointerEnter={() => { /* tilt kicks in on move */ }}
      onPointerLeave={resetTilt}
    >
      <motion.div
        className={`habit-dt-card habit-dt-led ${ledPulse ? "habit-dt-led-pulse" : ""} ${reduced ? "reduced" : ""}`}
        style={{ [`--habit-color` as string]: color }}
        onKeyDown={onKeyDown}
      >
        <div className="habit-dt-face">
          {/* Header */}
          <div className="habit-dt-header">
            <span className="habit-dt-label">Meta diária</span>
            <p className="habit-dt-hint">Quantas vezes por dia você quer concluir este hábito.</p>
          </div>

          {/* Value row */}
          <div className="habit-dt-value-row" role="group" aria-label="Meta diária">
            {editing ? (
              <motion.input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
                onBlur={() => finishEdit(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); finishEdit(true); }
                  if (event.key === "Escape") { event.preventDefault(); finishEdit(false); }
                }}
                className={`habit-dt-input ${shaking ? "shake" : ""}`}
                aria-label="Editar meta diária"
              />
            ) : (
              <span
                ref={numberRef}
                role="spinbutton"
                tabIndex={disabled ? -1 : 0}
                aria-label="Meta diária"
                aria-valuemin={DAILY_TARGET_MIN}
                aria-valuemax={DAILY_TARGET_MAX}
                aria-valuenow={clamped}
                aria-valuetext={formatDailyTarget(clamped)}
                aria-disabled={disabled || undefined}
                className="habit-dt-number"
                onClick={startEdit}
                onKeyDown={onKeyDown}
                onWheel={onWheel}
              >
                <OdometerNumber value={clamped} />
              </span>
            )}

            <span className="habit-dt-unit-wrapper">
              <span className="habit-dt-unit">{unitText}</span>
            </span>

            <div className="habit-dt-step-group">
              <RoundButton
                aria-label="Diminuir meta diária"
                onClick={onPointerDownHandler(stepDown)}
                onPressStart={() => startHold(stepDown)}
                onPressEnd={() => endHold(stepDown)}
                pressed={false}
                disabled={disabled || clamped <= DAILY_TARGET_MIN}
                color={color}
              >
                <Minus size={20} aria-hidden="true" />
              </RoundButton>
              <RoundButton
                aria-label="Aumentar meta diária"
                onClick={onPointerDownHandler(stepUp)}
                onPressStart={() => startHold(stepUp)}
                onPressEnd={() => endHold(stepUp)}
                pressed={false}
                disabled={disabled || clamped >= DAILY_TARGET_MAX}
                color={color}
              >
                <Plus size={20} aria-hidden="true" />
              </RoundButton>
            </div>
          </div>

          {/* Limit hint tooltip */}
          {limitHint && <span className="habit-dt-hint-tooltip" role="tooltip">{limitHint}</span>}

          {/* Presets */}
          <PresetBar active={activePreset} onSelect={selectPreset} color={color} reduced={reduced} />

          {/* Pips (visual target preview) */}
          <Pips value={clamped} color={color} />

          {/* Polite live region: announces the value text as it changes */}
          <span className="habit-dt-live" aria-live="polite" aria-atomic="true">
            {formatDailyTarget(clamped)}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
