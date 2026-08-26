"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Timer, Zap } from "lucide-react";
import Image from "next/image";
import type { FocusSession } from "@/types";
import { CircularDurationPicker } from "./circular-duration-picker";

// ─── Constants ───────────────────────────────────────────────────────────────

const RING_SIZE = 260;
const MAX_DURATION = 120;
const SNAP_INCREMENT = 5;
const MIN_DURATION = 10;

// ─── Energy asset map ────────────────────────────────────────────────────────

type EnergyStage = "spark" | "forming" | "full" | "extinguished";
type EnergyType =
  | "flame" | "water" | "earth" | "wind" | "thunder" | "ice"
  | "shadow" | "light" | "metal" | "nature" | "cosmic" | "void";

const ENERGY_ASSETS: Record<EnergyType, Record<EnergyStage, string>> = {
  flame:   { spark: "/energies/flame_spark.svg",   forming: "/energies/flame_forming.svg",   full: "/energies/flame_full.svg",   extinguished: "/energies/flame_extinguished.svg"   },
  water:   { spark: "/energies/water_spark.svg",   forming: "/energies/water_forming.svg",   full: "/energies/water_full.svg",   extinguished: "/energies/water_extinguished.svg"   },
  earth:   { spark: "/energies/earth_spark.svg",   forming: "/energies/earth_forming.svg",   full: "/energies/earth_full.svg",   extinguished: "/energies/earth_extinguished.svg"   },
  wind:    { spark: "/energies/wind_spark.svg",    forming: "/energies/wind_forming.svg",    full: "/energies/wind_full.svg",    extinguished: "/energies/wind_extinguished.svg"    },
  thunder: { spark: "/energies/thunder_spark.svg", forming: "/energies/thunder_forming.svg", full: "/energies/thunder_full.svg", extinguished: "/energies/thunder_extinguished.svg" },
  ice:     { spark: "/energies/ice_spark.svg",     forming: "/energies/ice_forming.svg",     full: "/energies/ice_full.svg",     extinguished: "/energies/ice_extinguished.svg"     },
  shadow:  { spark: "/energies/shadow_spark.svg",  forming: "/energies/shadow_forming.svg",  full: "/energies/shadow_full.svg",  extinguished: "/energies/shadow_extinguished.svg"  },
  light:   { spark: "/energies/light_spark.svg",   forming: "/energies/light_forming.svg",   full: "/energies/light_full.svg",   extinguished: "/energies/light_extinguished.svg"   },
  metal:   { spark: "/energies/metal_spark.svg",   forming: "/energies/metal_forming.svg",   full: "/energies/metal_full.svg",   extinguished: "/energies/metal_extinguished.svg"   },
  nature:  { spark: "/energies/nature_spark.svg",  forming: "/energies/nature_forming.svg",  full: "/energies/nature_full.svg",  extinguished: "/energies/nature_extinguished.svg"  },
  cosmic:  { spark: "/energies/cosmic_spark.svg",  forming: "/energies/cosmic_forming.svg",  full: "/energies/cosmic_full.svg",  extinguished: "/energies/cosmic_extinguished.svg"  },
  void:    { spark: "/energies/void_spark.svg",    forming: "/energies/void_forming.svg",    full: "/energies/void_full.svg",    extinguished: "/energies/void_extinguished.svg"    },
};

// Glow accent per energy type (used for the inner backdrop disc)
const ENERGY_GLOW: Record<EnergyType, string> = {
  flame:   "rgba(255,107,53,0.22)",
  water:   "rgba(79,195,247,0.22)",
  earth:   "rgba(139,195,74,0.22)",
  wind:    "rgba(176,190,197,0.18)",
  thunder: "rgba(255,214,0,0.22)",
  ice:     "rgba(128,222,234,0.22)",
  shadow:  "rgba(179,157,219,0.22)",
  light:   "rgba(255,249,196,0.28)",
  metal:   "rgba(144,164,174,0.18)",
  nature:  "rgba(102,187,106,0.22)",
  cosmic:  "rgba(206,147,216,0.22)",
  void:    "rgba(84,110,122,0.18)",
};

const ENERGY_ACCENT: Record<EnergyType, string> = {
  flame:   "#ff6b35",
  water:   "#4fc3f7",
  earth:   "#8bc34a",
  wind:    "#b0bec5",
  thunder: "#ffd600",
  ice:     "#80deea",
  shadow:  "#b39ddb",
  light:   "#fff9c4",
  metal:   "#90a4ae",
  nature:  "#66bb6a",
  cosmic:  "#ce93d8",
  void:    "#546e7a",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateCoins(durationMinutes: number): number {
  if (durationMinutes < 10) return 0;
  if (durationMinutes <= 60) return Math.round(9 + 16 * ((durationMinutes - 10) / 50));
  return Math.round(25 + 25 * ((Math.min(durationMinutes, 120) - 60) / 60));
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveStage(progress: number, isActive: boolean, isExtinguished: boolean): EnergyStage {
  if (isExtinguished) return "extinguished";
  if (!isActive) return "spark";
  if (progress < 25) return "spark";
  if (progress < 70) return "forming";
  return "full";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FocusTimerProps {
  todayStats: { minutesFocused: number; coinsEarned: number };
  history: FocusSession[];
  onStart: (targetDurationMinutes: number, taskId?: number) => Promise<{ session: FocusSession }>;
  onEnd: (sessionId: number, focusedSeconds: number) => Promise<{ session: FocusSession; xpAwarded: number }>;
  energyType?: EnergyType;
}

type TimerState = "idle" | "running" | "paused";

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusTimer({
  todayStats,
  history,
  onStart,
  onEnd,
  energyType = "flame",
}: FocusTimerProps) {
  const [duration, setDuration] = useState(25);
  const [state, setState] = useState<TimerState>("idle");
  const [session, setSession] = useState<{ id: number; startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  const [totalPaused, setTotalPaused] = useState(0);
  const [lastCoins, setLastCoins] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [isExtinguished, setIsExtinguished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const remaining = Math.max(0, duration * 60 - elapsed);
  const countdownProgress = Math.min((elapsed / (duration * 60)) * 100, 100);
  const previewCoins = calculateCoins(duration);
  const isActive = state !== "idle";
  const isPaused = state === "paused";

  const stage = resolveStage(countdownProgress, isActive, isExtinguished);
  const imageSrc = ENERGY_ASSETS[energyType][stage];
  const accentColor = ENERGY_ACCENT[energyType];
  const glowColor = ENERGY_GLOW[energyType];

  const updateTimer = useCallback(() => {
    if (state === "running" && session) {
      const now = Date.now();
      const pauseMs = totalPaused + (now - pausedAt);
      const effectiveElapsed = Math.floor((now - session.startedAt - pauseMs) / 1000);
      setElapsed(Math.max(0, effectiveElapsed));
      if (effectiveElapsed >= duration * 60) void handleStop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, session, totalPaused, pausedAt, duration]);

  useEffect(() => {
    if (state === "running") {
      timerRef.current = setInterval(updateTimer, 250);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state, updateTimer]);

  useEffect(() => {
    if (state === "running" && pausedAt === 0) setPausedAt(Date.now());
  }, [state, pausedAt]);

  async function handleStart() {
    try {
      const result = await onStart(duration);
      const startedAt = new Date(result.session.startedAt).getTime();
      setSession({ id: result.session.id, startedAt });
      setState("running");
      setElapsed(0);
      setTotalPaused(0);
      setPausedAt(Date.now());
      setLastCoins(0);
      setShowComplete(false);
      setIsExtinguished(false);
    } catch { /* handled by parent */ }
  }

  function handlePause() {
    if (state !== "running") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPausedAt(Date.now());
    setState("paused");
  }

  function handleResume() {
    if (state !== "paused" || !session) return;
    setTotalPaused((prev) => prev + (Date.now() - pausedAt));
    setPausedAt(0);
    setState("running");
  }

  async function handleStop(giveUp = false) {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (giveUp) setIsExtinguished(true);

    const now = Date.now();
    const pauseMs = state === "paused" ? totalPaused + (now - pausedAt) : totalPaused;
    const focusedSeconds = Math.max(0, Math.floor((now - session.startedAt - pauseMs) / 1000));

    try {
      const result = await onEnd(session.id, focusedSeconds);
      setLastCoins(result.xpAwarded);
      if (!giveUp) setShowComplete(true);
    } catch { /* handled by parent */ }

    setState("idle");
    setSession(null);
    setElapsed(0);
    setTotalPaused(0);
    setPausedAt(0);
  }

  // Image size inside the ring: ~58% of ring diameter
  const imageSize = Math.round(RING_SIZE * 0.58);

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 mb-5">
        <Timer size={16} className="text-[var(--accent)]" />
        <span className="eyebrow muted">FOCO</span>
      </div>

      {/* ── Ring + energy image ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center">
        <div
          className="relative mx-auto"
          style={{ width: RING_SIZE, maxWidth: "100%", aspectRatio: "1 / 1" }}
        >
          {/* Progress ring layer */}
          {state === "idle" ? (
            <CircularDurationPicker
              value={duration}
              onChange={setDuration}
              maxDurationMinutes={MAX_DURATION}
              snapIncrement={SNAP_INCREMENT}
              minMinutes={MIN_DURATION}
              size={RING_SIZE}
              accentColor={accentColor}
              centerContent={<></>}
            />
          ) : (
            <CountdownRing
              progress={countdownProgress}
              size={RING_SIZE}
              isPaused={isPaused}
              accentColor={accentColor}
            />
          )}

          {/* Energy image — centered inside ring */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 2 }}
          >
            {/* Soft glowing base disc */}
            <div
              style={{
                position: "absolute",
                width: imageSize * 0.9,
                height: imageSize * 0.9,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${glowColor} 0%, transparent 72%)`,
                filter: "blur(2px)",
              }}
            />

            {/* Crossfading energy image */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${energyType}-${stage}`}
                initial={{ opacity: 0, scale: 0.88, filter: "blur(6px)" }}
                animate={
                  showComplete && stage === "full"
                    ? { opacity: 1, scale: [1, 1.12, 1], filter: "blur(0px)" }
                    : { opacity: 1, scale: 1, filter: "blur(0px)" }
                }
                exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{ position: "relative", zIndex: 1 }}
              >
                <Image
                  src={imageSrc}
                  alt={`${energyType} ${stage}`}
                  width={imageSize}
                  height={imageSize}
                  style={{ objectFit: "contain", display: "block" }}
                  priority
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Countdown — below the ring ──────────────────────────────────── */}
        <div className="mt-4 flex flex-col items-center gap-1">
          <span
            className="font-mono font-bold tabular-nums leading-none"
            style={{
              fontSize: 44,
              color: isPaused ? "#ffb86b" : "var(--text)",
              letterSpacing: "-0.04em",
              transition: "color 0.3s",
            }}
          >
            {isActive ? formatTime(remaining) : `${String(duration).padStart(2, "0")}:00`}
          </span>
          <span className="text-[11px] text-[var(--text-faint)] tracking-widest uppercase">
            {state === "running" ? "em andamento" : state === "paused" ? "pausado" : "duração"}
          </span>
        </div>

        {/* Coins preview / earned */}
        <div className="mt-3 h-7 flex items-center justify-center">
          {!isActive && !showComplete && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
              <Zap size={11} className="text-[#ffb86b]" />
              <span>{previewCoins} moedas se completar</span>
            </div>
          )}
          <AnimatePresence>
            {showComplete && lastCoins > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-1.5 rounded-full bg-[rgba(255,184,107,.12)] px-3 py-1.5"
              >
                <Zap size={13} className="text-[#ffb86b]" />
                <span className="text-xs font-mono font-bold text-[#ffb86b]">+{lastCoins} moedas!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Action buttons ──────────────────────────────────────────────── */}
        <div className="mt-4 flex justify-center gap-2">
          {state === "idle" && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleStart}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              style={{ background: accentColor }}
            >
              <Play size={14} fill="currentColor" /> Iniciar foco
            </motion.button>
          )}

          {state === "running" && (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handlePause}
                className="flex items-center gap-2 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-[var(--text)] hover:bg-[var(--bg-surface-active)] transition-colors"
              >
                <Pause size={14} /> Pausar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => handleStop(true)}
                className="flex items-center gap-2 rounded-full bg-[#ffb86b] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              >
                <Square size={12} fill="currentColor" /> Parar
              </motion.button>
            </>
          )}

          {state === "paused" && (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleResume}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
                style={{ background: accentColor }}
              >
                <Play size={14} fill="currentColor" /> Continuar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => handleStop(true)}
                className="flex items-center gap-2 rounded-full bg-[#ffb86b] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              >
                <Square size={12} fill="currentColor" /> Parar
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* ── Today stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 mt-6">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold" style={{ color: accentColor }}>
            {todayStats.minutesFocused}min
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">foco hoje</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold text-[#ffb86b]">{todayStats.coinsEarned}</div>
          <div className="text-[10px] text-[var(--text-faint)]">moedas hoje</div>
        </div>
      </div>

      {/* ── Recent sessions ─────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="mt-4">
          <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Sessões recentes</span>
          <div className="mt-2 space-y-1">
            {history.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[10px] py-1">
                <span className="text-[var(--text-muted)]">{s.durationMinutes}min</span>
                <span className="text-[#ffb86b] font-mono">+{s.xpEarned}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Countdown ring (active state) ───────────────────────────────────────────

function CountdownRing({
  progress,
  size,
  isPaused,
  accentColor,
}: {
  progress: number;
  size: number;
  isPaused: boolean;
  accentColor: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 8;
  const arcLength = (progress / 100) * circumference;
  const color = isPaused ? "#ffb86b" : accentColor;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <filter id="countdown-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} opacity={0.35} />
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{
          filter: "url(#countdown-glow)",
          transition: "stroke-dasharray 0.3s linear, stroke 0.3s",
        }}
      />
    </svg>
  );
}
