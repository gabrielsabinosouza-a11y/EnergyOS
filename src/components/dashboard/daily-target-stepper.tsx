"use client";

import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type ReactNode,
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

const EASE_OUT = [0.34, 1.18, 0.66, 1] as const; // tiny overshoot, per spec tokens
const SPRING_BUMPY = { type: "spring", stiffness: 480, damping: 16 } as const;

function clamp(value: number): number {
  const n = Math.round(Number(value) || 0);
  return Math.max(DAILY_TARGET_MIN, Math.min(DAILY_TARGET_MAX, n));
}
function pluralWord(count: number): "vez" | "vezes" {
  return count === 1 ? "vez" : "vezes";
}
/** e.g. "3 vezes por dia" — used for aria-valuetext + the polite live region. */
export function formatDailyTarget(count: number): string {
  return `${count} ${pluralWord(count)} por dia`;
}
function matchMediaCoarse(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Latest committed value, kept fresh in an effect (never during render) so
  // the 60ms hold-repeat ticks always read the current value.
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [shaking, setShaking] = useState(false);
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const [bumping, setBumping] = useState(false);
  const [ledPulse, setLedPulse] = useState(false);
  // Shared "is a hold in progress" flag for the +/- buttons.
  const heldRef = useRef(false);

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

  // ── Press-and-hold with acceleration: 400ms → 120ms → 60ms ────────────────
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (pressIntervalRef.current) clearTimeout(pressIntervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pressTimerRef.current = null;
    pressIntervalRef.current = null;
    rafRef.current = null;
  }, []);

  const startHold = useCallback(
    (dir: 1 | -1, fn: () => void) => {
      if (disabled) return;
      clearTimers();
      heldRef.current = false;
      pressTimerRef.current = setTimeout(() => {
        heldRef.current = true;
        fn();
        let idx = 0;
        const delays = [120, 60]; // first repeat at 400ms (above), then 120, then 60
        const tick = () => {
          if (heldRef.current !== true) return;
          const v = valueRef.current;
          const atLimit =
            (dir === 1 && v >= DAILY_TARGET_MAX) || (dir === -1 && v <= DAILY_TARGET_MIN);
          if (atLimit) { clearTimers(); return; }
          fn();
          const d = delays[Math.min(idx, delays.length - 1)];
          idx = Math.min(idx + 1, delays.length - 1);
          pressIntervalRef.current = setTimeout(tick, d);
        };
        pressIntervalRef.current = setTimeout(tick, 120);
      }, 400);
    },
    [disabled, clearTimers],
  );

  // Cancels a pending hold without stepping (pointerup): stops the 400ms timer
  // so a short click doesn't accidentally start a hold. Does NOT reset heldRef,
  // so the following `click` knows whether a hold had already fired.
  const cancelHold = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  // Click handler: single step only when no hold fired (gated by heldRef).
  const fireClick = useCallback(
    (fn: () => void) => {
      const wasHeld = heldRef.current;
      clearTimers();
      heldRef.current = false;
      if (!wasHeld && !disabled) fn();
    },
    [disabled, clearTimers],
  );

  // Pointer left the button — abort cleanly; no click will fire, so reset held.
  const abortHold = useCallback(() => {
    clearTimers();
    heldRef.current = false;
  }, [clearTimers]);

  useEffect(() => abortHold, [abortHold]);

  // ── Click-to-edit the number ──────────────────────────────────────────────
  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(String(clamped));
    setEditing(true);
  }, [clamped, disabled]);

  const finishEdit = useCallback(
    (commit: boolean) => {
      if (!commit) { setEditing(false); setDraft(""); return; }
      const raw = Number(draft);
      if (!Number.isFinite(raw) || draft.trim() === "") {
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
    },
    [draft, onChange],
  );

  // Select-all on focus while editing.
  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    const t = setTimeout(() => { el?.focus(); el?.select(); }, 0);
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

  // ── Mouse wheel: changes value only while the number is focused ───────────
  const onWheel = (event: WheelEvent<HTMLSpanElement>) => {
    if (disabled || document.activeElement !== event.currentTarget) return;
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    if (delta < 0) stepUp();
    else if (delta > 0) stepDown();
  };

  // ── 3D tilt (cursor-following). Disabled on touch / reduced motion ────────
  const tiltEnabled = !reduced && !matchMediaCoarse();
  const onCardMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!tiltEnabled || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const card = cardRef.current;
        if (!card) return;
        card.style.setProperty("--tilt-x", `${(px - 0.5) * 8}deg`);
        card.style.setProperty("--tilt-y", `${(0.5 - py) * 8}deg`);
        card.style.setProperty("--glare-x", `${px * 100}%`);
        card.style.setProperty("--glare-y", `${py * 100}%`);
      });
    },
    [tiltEnabled],
  );
  const resetTilt = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.removeProperty("--tilt-x");
    cardRef.current.style.removeProperty("--tilt-y");
    cardRef.current.style.removeProperty("--glare-x");
    cardRef.current.style.removeProperty("--glare-y");
  }, []);

  // ── Presets ───────────────────────────────────────────────────────────────
  const selectPreset = useCallback((preset: number) => {
    if (disabled) return;
    onChange(clamp(preset));
    pulseLed();
  }, [disabled, onChange, pulseLed]);

  const activePreset = DAILY_TARGET_PRESETS.includes(clamped as (typeof DAILY_TARGET_PRESETS)[number])
    ? clamped
    : null;

  const cardStyle: CSSProperties = { ["--habit-color" as string]: color };

  return (
    <div
      ref={cardRef}
      className="habit-dt-perspective w-full"
      style={cardStyle}
      onPointerMove={onCardMove}
      onPointerLeave={resetTilt}
    >
      <motion.div
        className={`habit-dt-card habit-dt-led ${ledPulse ? "habit-dt-led-pulse" : ""}`}
        style={cardStyle}
      >
        <div className="habit-dt-face">
          {/* Header */}
          <div className="habit-dt-header">
            <span className="habit-dt-label">Meta diária</span>
            <p className="habit-dt-hint">Quantas vezes por dia você quer concluir este hábito.</p>
          </div>

          {/* Value row */}
          <div className="habit-dt-value-row" role="group" aria-label="Meta diária">
            <div className="habit-dt-number-group">
              {editing ? (
                <motion.input
                  ref={inputRef}
                  type="text"
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
                  onClick={(event) => event.currentTarget.select()}
                  className={`habit-dt-input ${shaking ? "shake" : ""}`}
                  aria-label="Editar meta diária"
                />
              ) : (
                <span
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
                  <OdometerNumber value={clamped} bumping={bumping} />
                </span>
              )}

              <span className="habit-dt-unit-wrapper">
                <span className="habit-dt-unit">{`${pluralWord(clamped)} por dia`}</span>
              </span>
            </div>

            <div className="habit-dt-step-group">
              <RoundButton
                aria-label="Diminuir meta diária"
                color={color}
                icon={<Minus size={20} aria-hidden="true" />}
                disabled={disabled || clamped <= DAILY_TARGET_MIN}
                onPressStart={() => startHold(-1, stepDown)}
                onPressEnd={cancelHold}
                onPressLeave={abortHold}
                onActivate={() => fireClick(stepDown)}
              />
              <RoundButton
                aria-label="Aumentar meta diária"
                color={color}
                icon={<Plus size={20} aria-hidden="true" />}
                disabled={disabled || clamped >= DAILY_TARGET_MAX}
                onPressStart={() => startHold(1, stepUp)}
                onPressEnd={cancelHold}
                onPressLeave={abortHold}
                onActivate={() => fireClick(stepUp)}
              />
            </div>
          </div>

          {/* Limit hint tooltip (appears on shake) */}
          {limitHint && <span className="habit-dt-hint-tooltip" role="tooltip">{limitHint}</span>}

          {/* Presets */}
          <PresetBar active={activePreset} onSelect={selectPreset} disabled={disabled} />

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

// ── Odometer / slot-machine roll ─────────────────────────────────────────────
type RollDir = "up" | "down" | "same";
const rollVariant = (dir: RollDir): { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } => {
  if (dir === "up") return { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 } };
  if (dir === "down") return { initial: { y: -20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 20, opacity: 0 } };
  return { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };
};

function OdometerNumber({ value, bumping }: { value: number; bumping: boolean }) {
  const reduced = useReducedMotion();
  // `transition` holds { from, to } during a roll; both spans are driven from it
  // (direction is derived from from/to) so no setState-in-effect is needed.
  const [transition, setTransition] = useState<{ from: number; to: number } | null>(null);
  const outgoing = transition ? transition.from : null;
  const shown = transition ? transition.to : value;

  useEffect(() => {
    if (value === shown) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransition({ from: shown, to: value });
    const t = setTimeout(() => setTransition(null), 320);
    return () => clearTimeout(t);
  }, [value, shown]);

  if (reduced) {
    return <span className="habit-dt-number-text">{value}</span>;
  }

  // Direction is read from the transition pair, so the outgoing span's exit
  // variant is always correct (never stale).
  const dir: RollDir = outgoing != null && shown > outgoing ? "up"
    : outgoing != null && shown < outgoing ? "down" : "same";

  return (
    <motion.span
      className="habit-dt-number-text"
      animate={bumping ? { scale: [1, 0.92, 1] } : { scale: 1 }}
      transition={bumping ? SPRING_BUMPY : { duration: 0.26, ease: EASE_OUT }}
    >
      <AnimatePresence initial={false}>
        {outgoing != null && (
          <motion.span
            key={`out-${outgoing}`}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={rollVariant(dir).exit}
            transition={{ duration: 0.26, ease: EASE_OUT, opacity: { duration: 0.22 } }}
          >
            {outgoing}
          </motion.span>
        )}
        <motion.span
          key={`in-${shown}`}
          initial={rollVariant(dir).initial}
          animate={rollVariant(dir).animate}
          transition={{ duration: 0.26, ease: EASE_OUT, opacity: { duration: 0.22 } }}
        >
          {shown}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

// ── Round step button with physical press feel + color ripple ─────────────────
interface RoundButtonProps {
  "aria-label": string;
  color: string;
  icon: ReactNode;
  disabled?: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onPressLeave: () => void;
  onActivate: () => void;
}

function RoundButton({
  "aria-label": ariaLabel,
  color,
  icon,
  disabled,
  onPressStart,
  onPressEnd,
  onPressLeave,
  onActivate,
}: RoundButtonProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const addRipple = (event: PointerEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((p) => p.id !== id)), 560);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className="habit-dt-step relative isolate"
      style={{ ["--habit-color" as string]: color }}
      onPointerDown={(event) => { if (!disabled) addRipple(event); onPressStart?.(); }}
      onPointerUp={onPressEnd}
      onPointerLeave={() => onPressLeave?.()}
      onClick={onActivate}
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={reduced ? undefined : { scale: 0.94, y: 2 }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
    >
      <span className="relative z-10">{icon}</span>
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="habit-dt-ripple"
            style={{ left: r.x - 10, top: r.y - 10 }}
            initial={{ width: 20, height: 20, opacity: 0.55 }}
            animate={{ width: 110, height: 110, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.56, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Preset pills with a shared sliding indicator ─────────────────────────────
function PresetBar({
  active,
  onSelect,
  disabled,
}: {
  active: number | null;
  onSelect: (preset: number) => void;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="habit-dt-presets" role="group" aria-label="Predefinições de meta">
      <motion.div className="habit-dt-presets-track" layout>
        {DAILY_TARGET_PRESETS.map((preset) => {
          const isActive = active === preset;
          return (
            <motion.button
              key={preset}
              type="button"
              aria-pressed={isActive}
              aria-label={`Definir meta para ${preset} ${preset === 1 ? "vez" : "vezes"} por dia`}
              disabled={disabled}
              className={`habit-dt-pill ${isActive ? "habit-dt-pill-active" : ""}`}
              onClick={() => onSelect(preset)}
              whileHover={reduced ? undefined : { y: -1 }}
              whileTap={reduced ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
            >
              {isActive && (
                <motion.span
                  layoutId="habit-dt-pill-indicator"
                  className="habit-dt-pill-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                />
              )}
              <span className="relative z-10">{preset}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Target preview pips (max 10, then "+N") ──────────────────────────────────
function Pips({ value, color }: { value: number; color: string }) {
  const count = Math.min(value, PIP_SEGMENTS);
  const segments = Array.from({ length: PIP_SEGMENTS }, (_, i) => i < count);
  return (
    <div
      className="habit-dt-pips"
      aria-label={`Visualização da meta: ${formatDailyTarget(value)}`}
    >
      {segments.map((on, i) => (
        <span
          key={i}
          className="habit-dt-pip"
          data-on={on}
          style={{ transitionDelay: `${i * 30}ms` }}
          aria-hidden="true"
        >
          <span className="habit-dt-pip-dot" style={{ backgroundColor: color }} />
        </span>
      ))}
      {value > PIP_SEGMENTS && (
        <span className="habit-dt-pip-count" aria-hidden="true">
          +{value - PIP_SEGMENTS}
        </span>
      )}
    </div>
  );
}
