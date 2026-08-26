"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Timer, Zap, Lock, X } from "lucide-react";
import Image from "next/image";
import type { FocusSession } from "@/types";
import { CircularDurationPicker } from "./circular-duration-picker";
import {
  ENERGY_CONFIGS,
  ENERGY_TYPES,
  getEnergyReward,
  type EnergyType,
  type EnergyStage,
} from "@/lib/energy-assets";
import { addGardenEntry } from "@/lib/garden-store";

// ─── Constants ───────────────────────────────────────────────────────────────

const RING_SIZE = 260;
const MAX_DURATION = 120;
const SNAP_INCREMENT = 5;
const MIN_DURATION = 10;

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
}

type TimerState = "idle" | "running" | "paused";

// ─── Energy Picker Modal ──────────────────────────────────────────────────────

function EnergyPickerModal({
  current,
  onSelect,
  onClose,
}: {
  current: EnergyType;
  onSelect: (t: EnergyType) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="glass-card w-full max-w-sm overflow-hidden p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-[var(--text-faint)]">Escolher energia</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition">
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {ENERGY_TYPES.map((type) => {
            const cfg = ENERGY_CONFIGS[type];
            const isSelected = type === current;
            return (
              <button
                key={type}
                onClick={() => { if (!cfg.locked) { onSelect(type); onClose(); } }}
                disabled={cfg.locked}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition"
                style={{
                  background: isSelected ? `${cfg.glow}` : "transparent",
                  border: isSelected ? `1px solid ${cfg.accent}44` : "1px solid transparent",
                  opacity: cfg.locked ? 0.4 : 1,
                  cursor: cfg.locked ? "not-allowed" : "pointer",
                }}
              >
                <div className="relative w-12 h-12">
                  <Image
                    src={cfg.assets.full}
                    alt={cfg.label}
                    fill
                    style={{ objectFit: "contain" }}
                    unoptimized
                  />
                  {cfg.locked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock size={14} className="text-[var(--text-faint)]" />
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-[var(--text-muted)] leading-none">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
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
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
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
        style={{ filter: "url(#countdown-glow)", transition: "stroke-dasharray 0.3s linear, stroke 0.3s" }}
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusTimer({ todayStats, history, onStart, onEnd }: FocusTimerProps) {
  const [duration, setDuration] = useState(25);
  const [state, setState] = useState<TimerState>("idle");
  const [session, setSession] = useState<{ id: number; startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pauseAccum, setPauseAccum] = useState(0);   // total ms paused so far
  const [pauseStart, setPauseStart] = useState(0);   // timestamp when current pause began
  const [lastCoins, setLastCoins] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [rewardCount, setRewardCount] = useState(1);
  const [isExtinguished, setIsExtinguished] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyType>("flame");
  const [showPicker, setShowPicker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDurationSec = duration * 60;
  const remaining = Math.max(0, totalDurationSec - elapsed);
  const countdownProgress = Math.min((elapsed / totalDurationSec) * 100, 100);
  const previewCoins = calculateCoins(duration);
  const isActive = state !== "idle";
  const isPaused = state === "paused";

  const stage = resolveStage(countdownProgress, isActive, isExtinguished);
  const cfg = ENERGY_CONFIGS[selectedEnergy];
  const imageSrc = cfg.assets[stage];
  const imageSize = Math.round(RING_SIZE * 0.58);

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    setSession((sess) => {
      if (!sess) return sess;
      const now = Date.now();
      const effectiveElapsed = Math.floor((now - sess.startedAt - pauseAccum) / 1000);
      setElapsed(Math.max(0, effectiveElapsed));
      return sess;
    });
  }, [pauseAccum]);

  useEffect(() => {
    if (state !== "running") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(tick, 250);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state, tick]);

  // Auto-complete when time runs out
  useEffect(() => {
    if (state === "running" && elapsed >= totalDurationSec && session) {
      void handleStop(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, totalDurationSec, state]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleStart() {
    try {
      const result = await onStart(duration);
      const startedAt = new Date(result.session.startedAt).getTime();
      setSession({ id: result.session.id, startedAt });
      setState("running");
      setElapsed(0);
      setPauseAccum(0);
      setPauseStart(0);
      setLastCoins(0);
      setShowComplete(false);
      setIsExtinguished(false);
    } catch { /* handled by parent */ }
  }

  function handlePause() {
    if (state !== "running") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPauseStart(Date.now());
    setState("paused");
  }

  function handleResume() {
    if (state !== "paused") return;
    setPauseAccum((prev) => prev + (Date.now() - pauseStart));
    setPauseStart(0);
    setState("running");
  }

  async function handleStop(giveUp = false) {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (giveUp) setIsExtinguished(true);

    const now = Date.now();
    const totalPaused = pauseAccum + (state === "paused" ? now - pauseStart : 0);
    const focusedSeconds = Math.max(0, Math.floor((now - session.startedAt - totalPaused) / 1000));
    const focusedMinutes = Math.floor(focusedSeconds / 60);

    try {
      const result = await onEnd(session.id, focusedSeconds);
      setLastCoins(result.xpAwarded);

      if (!giveUp) {
        const reward = getEnergyReward(focusedMinutes);
        setRewardCount(reward);
        setShowComplete(true);

        // Persist to garden
        if (reward > 0) {
          for (let i = 0; i < reward; i++) {
            addGardenEntry({
              energyType: selectedEnergy,
              durationMinutes: focusedMinutes,
              reward,
              plantedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* handled by parent */ }

    setState("idle");
    setSession(null);
    setElapsed(0);
    setPauseAccum(0);
    setPauseStart(0);
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 mb-5">
        <Timer size={16} className="text-[var(--accent)]" />
        <span className="eyebrow muted">FOCO</span>
      </div>

      {/* ── Ring + energy image ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center">
        <div className="relative mx-auto" style={{ width: RING_SIZE, maxWidth: "100%", aspectRatio: "1 / 1" }}>
          {/* Progress ring */}
          {state === "idle" ? (
            <CircularDurationPicker
              value={duration}
              onChange={setDuration}
              maxDurationMinutes={MAX_DURATION}
              snapIncrement={SNAP_INCREMENT}
              minMinutes={MIN_DURATION}
              size={RING_SIZE}
              accentColor={cfg.accent}
              centerContent={<></>}
            />
          ) : (
            <CountdownRing
              progress={countdownProgress}
              size={RING_SIZE}
              isPaused={isPaused}
              accentColor={cfg.accent}
            />
          )}

          {/* Energy image — centered inside ring */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
            {/* Glow disc */}
            <div style={{
              position: "absolute",
              width: imageSize * 0.9,
              height: imageSize * 0.9,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 72%)`,
              filter: "blur(2px)",
            }} />

            {/* Clickable in idle to open picker */}
            <button
              onClick={() => { if (state === "idle") setShowPicker(true); }}
              style={{
                position: "relative",
                zIndex: 1,
                cursor: state === "idle" ? "pointer" : "default",
                background: "none",
                border: "none",
                padding: 0,
              }}
              aria-label="Escolher energia"
            >
              <AnimatePresence mode="wait">
                {showComplete && rewardCount > 1 ? (
                  // Multi-energy celebration cluster
                  <motion.div
                    key="cluster"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: "relative", width: imageSize, height: imageSize }}
                  >
                    {Array.from({ length: rewardCount }).map((_, i) => {
                      const angle = (i / rewardCount) * 2 * Math.PI - Math.PI / 2;
                      const r = imageSize * 0.28;
                      const x = Math.cos(angle) * r;
                      const y = Math.sin(angle) * r;
                      const size = Math.round(imageSize * 0.42);
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.12, type: "spring", stiffness: 320, damping: 18 }}
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                            filter: `drop-shadow(0 0 8px ${cfg.accent})`,
                          }}
                        >
                          <Image
                            src={cfg.assets.full}
                            alt={selectedEnergy}
                            width={size}
                            height={size}
                            style={{ objectFit: "contain" }}
                            unoptimized
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${selectedEnergy}-${stage}`}
                    initial={{ opacity: 0, scale: 0.88, filter: "blur(6px)" }}
                    animate={
                      showComplete && stage === "full"
                        ? { opacity: 1, scale: [1, 1.12, 1], filter: "blur(0px)" }
                        : { opacity: 1, scale: 1, filter: "blur(0px)" }
                    }
                    exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  >
                    <Image
                      src={imageSrc}
                      alt={`${selectedEnergy} ${stage}`}
                      width={imageSize}
                      height={imageSize}
                      style={{ objectFit: "contain", display: "block" }}
                      unoptimized
                      priority
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* "tap to choose" hint in idle */}
            {state === "idle" && (
              <span
                style={{
                  position: "absolute",
                  bottom: imageSize * 0.05,
                  fontSize: 9,
                  color: "var(--text-faint)",
                  letterSpacing: "0.08em",
                  pointerEvents: "none",
                  textTransform: "uppercase",
                }}
              >
                toque para trocar
              </span>
            )}
          </div>
        </div>

        {/* ── Countdown ──────────────────────────────────────────────────── */}
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
                {rewardCount > 1 && (
                  <span className="text-xs font-mono text-[var(--text-muted)]">· {rewardCount}× {cfg.label}</span>
                )}
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
              style={{ background: cfg.accent }}
            >
              <Play size={14} fill="currentColor" /> Iniciar foco
            </motion.button>
          )}

          {state === "running" && (
            <>
              <motion.button whileTap={{ scale: 0.92 }} onClick={handlePause}
                className="flex items-center gap-2 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-[var(--text)] hover:bg-[var(--bg-surface-active)] transition-colors">
                <Pause size={14} /> Pausar
              </motion.button>
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleStop(true)}
                className="flex items-center gap-2 rounded-full bg-[#ffb86b] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity">
                <Square size={12} fill="currentColor" /> Parar
              </motion.button>
            </>
          )}

          {state === "paused" && (
            <>
              <motion.button whileTap={{ scale: 0.92 }} onClick={handleResume}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
                style={{ background: cfg.accent }}>
                <Play size={14} fill="currentColor" /> Continuar
              </motion.button>
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleStop(true)}
                className="flex items-center gap-2 rounded-full bg-[#ffb86b] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity">
                <Square size={12} fill="currentColor" /> Parar
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* ── Today stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 mt-6">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold" style={{ color: cfg.accent }}>{todayStats.minutesFocused}min</div>
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

      {/* ── Energy picker modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showPicker && (
          <EnergyPickerModal
            current={selectedEnergy}
            onSelect={setSelectedEnergy}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
