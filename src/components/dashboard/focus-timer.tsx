"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Timer, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import type { FocusSession } from "@/types";

const DURATION_OPTIONS = Array.from({ length: 23 }, (_, i) => 10 + i * 5);

function calculateCoins(durationMinutes: number): number {
  if (durationMinutes < 10) return 0;
  if (durationMinutes <= 60) {
    return Math.round(9 + 16 * ((durationMinutes - 10) / 50));
  }
  return Math.round(25 + 25 * ((Math.min(durationMinutes, 120) - 60) / 60));
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface FocusTimerProps {
  todayStats: { minutesFocused: number; coinsEarned: number };
  history: FocusSession[];
  onStart: (targetDurationMinutes: number, taskId?: number) => Promise<{ session: FocusSession }>;
  onEnd: (sessionId: number, focusedSeconds: number) => Promise<{ session: FocusSession; xpAwarded: number }>;
}

type TimerState = "idle" | "running" | "paused";

export function FocusTimer({ todayStats, history, onStart, onEnd }: FocusTimerProps) {
  const [duration, setDuration] = useState(25);
  const [state, setState] = useState<TimerState>("idle");
  const [session, setSession] = useState<{ id: number; startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  const [totalPaused, setTotalPaused] = useState(0);
  const [lastCoins, setLastCoins] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, duration * 60 - elapsed);
  const progress = Math.min((elapsed / (duration * 60)) * 100, 100);
  const previewCoins = calculateCoins(duration);

  const updateTimer = useCallback(() => {
    if (state === "running" && session) {
      const now = Date.now();
      const pauseMs = totalPaused + (now - pausedAt);
      const effectiveElapsed = Math.floor((now - session.startedAt - pauseMs) / 1000);
      setElapsed(Math.max(0, effectiveElapsed));

      if (effectiveElapsed >= duration * 60) {
        handleStop();
      }
    }
  }, [state, session, totalPaused, pausedAt, duration]);

  useEffect(() => {
    if (state === "running") {
      timerRef.current = setInterval(updateTimer, 250);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, updateTimer]);

  useEffect(() => {
    if (state === "running" && pausedAt === 0) {
      setPausedAt(Date.now());
    }
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
    } catch {
      // error handled by parent
    }
  }

  function handlePause() {
    if (state !== "running") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPausedAt(Date.now());
    setState("paused");
  }

  function handleResume() {
    if (state !== "paused" || !session) return;
    const pauseDuration = Date.now() - pausedAt;
    setTotalPaused((prev) => prev + pauseDuration);
    setPausedAt(0);
    setState("running");
  }

  async function handleStop() {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const now = Date.now();
    const pauseMs = state === "paused" ? totalPaused + (now - pausedAt) : totalPaused;
    const focusedSeconds = Math.max(0, Math.floor((now - session.startedAt - pauseMs) / 1000));

    try {
      const result = await onEnd(session.id, focusedSeconds);
      setLastCoins(result.xpAwarded);
      setShowComplete(true);
    } catch {
      // error handled by parent
    }

    setState("idle");
    setSession(null);
    setElapsed(0);
    setTotalPaused(0);
    setPausedAt(0);
  }

  function scrollDuration(dir: -1 | 1) {
    if (!scrollRef.current) return;
    const idx = DURATION_OPTIONS.indexOf(duration);
    const next = DURATION_OPTIONS[Math.max(0, Math.min(DURATION_OPTIONS.length - 1, idx + dir))];
    if (next !== undefined) setDuration(next);
    scrollRef.current.children[Math.max(0, Math.min(DURATION_OPTIONS.length - 1, idx + dir))]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const isActive = state !== "idle";

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 mb-5">
        <Timer size={16} className="text-[var(--accent)]" />
        <span className="eyebrow muted">FOCO</span>
      </div>

      {/* Duration selector */}
      <AnimatePresence>
        {!isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Duração</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => scrollDuration(-1)}
                  className="icon-button small"
                  disabled={duration <= 10}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => scrollDuration(1)}
                  className="icon-button small"
                  disabled={duration >= 120}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div
              ref={scrollRef}
              className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none" }}
            >
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-mono transition-all ${
                    d === duration
                      ? "bg-[var(--accent)] text-[var(--bg-primary)] font-bold shadow-[0_0_12px_var(--accent)]"
                      : "bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {d}min
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-faint)]">
              <Zap size={11} className="text-[#ffb86b]" />
              <span>
                {previewCoins} moedas se completar
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer display */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative mb-3">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {/* Background ring */}
            <circle
              cx="80" cy="80" r="68"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="4"
            />
            {/* Progress ring */}
            <circle
              cx="80" cy="80" r="68"
              fill="none"
              stroke={state === "paused" ? "#ffb86b" : "var(--accent)"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 427.3} 427.3`}
              transform="rotate(-90 80 80)"
              style={{
                filter: state === "paused" ? "drop-shadow(0 0 8px #ffb86b)" : "drop-shadow(0 0 8px var(--accent))",
                transition: "stroke-dasharray 0.3s linear, stroke 0.3s",
              }}
            />
          </svg>

          {/* Energy crystal in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <EnergyCrystal progress={progress} isActive={isActive} isPaused={state === "paused"} />
          </div>

          {/* Timer text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-[var(--text)] drop-shadow-lg">
              {isActive ? formatTime(remaining) : formatTime(duration * 60)}
            </span>
            <span className="text-[10px] text-[var(--text-faint)]">
              {state === "running" ? "em andamento" : state === "paused" ? "pausado" : "pronto"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {state === "idle" && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleStart}
              className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
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
                onClick={handleStop}
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
                className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              >
                <Play size={14} fill="currentColor" /> Continuar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleStop}
                className="flex items-center gap-2 rounded-full bg-[#ffb86b] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              >
                <Square size={12} fill="currentColor" /> Parar
              </motion.button>
            </>
          )}
        </div>

        {/* Coins earned animation */}
        <AnimatePresence>
          {showComplete && lastCoins > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-[rgba(255,184,107,.12)] px-3 py-1.5"
            >
              <Zap size={13} className="text-[#ffb86b]" />
              <span className="text-xs font-mono font-bold text-[#ffb86b]">+{lastCoins} moedas!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!showComplete && lastCoins === 0 && state === "idle" && elapsed > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-[var(--text-faint)]"
          >
            Sessão encerrada
          </motion.p>
        )}
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold text-[var(--accent)]">
            {todayStats.minutesFocused}min
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">foco hoje</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold text-[#ffb86b]">{todayStats.coinsEarned}</div>
          <div className="text-[10px] text-[var(--text-faint)]">moedas hoje</div>
        </div>
      </div>

      {/* Recent sessions */}
      {history.length > 0 && (
        <div>
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

function EnergyCrystal({ progress, isActive, isPaused }: { progress: number; isActive: boolean; isPaused: boolean }) {
  const glowColor = isPaused ? "#ffb86b" : "#71d4ff";
  const stage = progress < 25 ? 1 : progress < 50 ? 2 : progress < 75 ? 3 : 4;

  return (
    <div className="energy-crystal-container" style={{ width: 80, height: 80 }}>
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        className={`energy-crystal stage-${stage} ${isActive ? "active" : ""} ${isPaused ? "paused" : ""}`}
      >
        <defs>
          <filter id="crystal-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="crystal-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={glowColor} stopOpacity="1" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Stage 1: Seed */}
        <g opacity={stage >= 1 ? 1 : 0.2} style={{ transition: "opacity 0.5s" }}>
          <polygon
            points="40,62 36,68 40,74 44,68"
            fill="url(#crystal-gradient)"
            filter={isActive ? "url(#crystal-glow)" : undefined}
            style={{ transition: "all 0.5s" }}
          />
        </g>

        {/* Stage 2: Small crystal */}
        <g opacity={stage >= 2 ? 1 : 0} style={{ transition: "opacity 0.5s" }}>
          <polygon
            points="40,42 34,56 36,68 40,74 44,68 46,56"
            fill="url(#crystal-gradient)"
            filter={isActive ? "url(#crystal-glow)" : undefined}
            style={{ transition: "all 0.5s" }}
          />
        </g>

        {/* Stage 3: Medium crystal with left shard */}
        <g opacity={stage >= 3 ? 1 : 0} style={{ transition: "opacity 0.5s" }}>
          <polygon
            points="40,42 34,56 36,68 40,74 44,68 46,56"
            fill="url(#crystal-gradient)"
            filter={isActive ? "url(#crystal-glow)" : undefined}
          />
          <polygon
            points="32,50 26,58 30,64 36,58"
            fill={glowColor}
            opacity="0.6"
            style={{ transition: "all 0.5s" }}
          />
          <polygon
            points="48,50 54,58 50,64 44,58"
            fill={glowColor}
            opacity="0.6"
            style={{ transition: "all 0.5s" }}
          />
        </g>

        {/* Stage 4: Full crystal tree */}
        <g opacity={stage >= 4 ? 1 : 0} style={{ transition: "opacity 0.5s" }}>
          <polygon
            points="40,20 32,42 36,56 40,74 44,56 48,42"
            fill="url(#crystal-gradient)"
            filter={isActive ? "url(#crystal-glow)" : undefined}
          />
          <polygon
            points="30,38 22,50 26,58 34,50"
            fill={glowColor}
            opacity="0.5"
          />
          <polygon
            points="50,38 58,50 54,58 46,50"
            fill={glowColor}
            opacity="0.5"
          />
          <polygon
            points="34,28 28,36 32,42 38,36"
            fill={glowColor}
            opacity="0.4"
          />
          <polygon
            points="46,28 52,36 48,42 42,36"
            fill={glowColor}
            opacity="0.4"
          />
          {/* Top glow */}
          <circle
            cx="40" cy="18" r="3"
            fill={glowColor}
            opacity={isActive ? 0.9 : 0.4}
            filter="url(#crystal-glow)"
          >
            {isActive && (
              <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
            )}
          </circle>
        </g>
      </svg>
    </div>
  );
}
