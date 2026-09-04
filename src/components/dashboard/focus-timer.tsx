"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Timer, Bell, Zap } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import type { FocusSession } from "@/types";
import { CircularDurationPicker, FocusDurationReadout } from "./circular-duration-picker";
import {
  FOCUS_DURATION_DEFAULT_MINUTES,
  FOCUS_DURATION_MAX_MINUTES,
  FOCUS_DURATION_MIN_MINUTES,
  FOCUS_DURATION_SNAP_MINUTES,
  formatCountdownMmSs,
} from "@/lib/focus-duration";
import { EnergyPickerModal } from "@/components/energy-picker-modal";
import { GrowingEnergyIcon } from "@/components/growing-energy-icon";
import { RewardClaimModal } from "@/components/reward-claim-modal";
import { ENERGY_CONFIGS, getEnergyReward, resolveDefaultEnergy, type EnergyType } from "@/lib/energy-assets";
import { api } from "@/lib/api-client";
import {
  playCompletionSound,
  primeCompletionSound,
  restoreTabTitle,
  sendSystemCompletionNotification,
  startCompletionTitleFlash,
  updateCountdownTabTitle,
} from "@/lib/session-alerts";

// ─── Session Persistence Types ───────────────────────────────────────────────

type PersistedSessionState = "idle" | "running" | "paused" | "completed";

interface PersistedSession {
  sessionId: number | null;
  selectedEnergy: EnergyType;
  durationMinutes: number;
  sessionStartedAt: number | null; // timestamp in ms
  remainingMs: number | null; // remaining ms as of the start of the current run segment (frozen while paused)
  runningSince: number | null; // timestamp in ms when the current running segment began (null while paused)
  status: PersistedSessionState;
  lastUpdatedAt: number; // timestamp in ms
}

const STORAGE_KEY = "energyos_focus_session";

// ─── Session Persistence Utilities ───────────────────────────────────────────

function saveSessionState(session: PersistedSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn("Failed to save session state:", e);
  }
}

function loadSessionState(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.warn("Failed to load session state:", e);
    return null;
  }
}

function clearSessionState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear session state:", e);
  }
}

// Multi-tab behavior: Each tab manages its own session state independently.
// This allows users to have different sessions in different tabs without conflicts.
// If cross-tab sync is needed in the future, add a 'storage' event listener.

const RING_SIZE = 260;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateCoins(durationMinutes: number): number {
  if (durationMinutes < 10) return 0;
  if (durationMinutes <= 60) return Math.round(9 + 16 * ((durationMinutes - 10) / 50));
  return Math.round(25 + 25 * ((Math.min(durationMinutes, 120) - 60) / 60));
}

function formatTime(totalSeconds: number): string {
  return formatCountdownMmSs(totalSeconds);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FocusTimerProps {
  todayStats: { minutesFocused: number; coinsEarned: number };
  history: FocusSession[];
  boostActive: boolean;
  onStart: (targetDurationMinutes: number, taskId: number | undefined, energyType: string) => Promise<{ session: FocusSession }>;
  onEnd: (sessionId: number, focusedSeconds: number) => Promise<{ session: FocusSession; xpAwarded: number; coinsAwarded: number }>;
}

type TimerState = "idle" | "running" | "paused";

// ─── Countdown ring ───────────────────────────────────────────────────────────

function CountdownRing({ progress, size, isPaused, accentColor }: {
  progress: number; size: number; isPaused: boolean; accentColor: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (progress / 100) * circumference;
  const color = isPaused ? "#ffb86b" : accentColor;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: "100%", height: "auto", display: "block" }}>
      <defs>
        <filter id="countdown-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={8} opacity={0.35} />
      <circle
        cx={cx} cy={cy} r={radius} fill="none"
        stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: "url(#countdown-glow)", transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
      />
    </svg>
  );
}

// ─── Completion banner ────────────────────────────────────────────────────────

function CompletionBanner({ coins, rewardCount, energyLabel, accentColor, boostActive, onClaim }: {
  coins: number; rewardCount: number; energyLabel: string; accentColor: string; boostActive: boolean; onClaim: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
      className="mt-4 rounded-2xl border p-4 flex flex-col items-center gap-3 text-center"
      style={{ borderColor: `${accentColor}33`, background: `${accentColor}0f` }}
    >
      <span className="text-xs uppercase tracking-widest text-[var(--text-faint)]">Sessão concluída!</span>
      <div className="flex items-center gap-2">
        <CoinIcon size={18} />
        <span className="font-mono font-bold text-[#ffb86b] text-lg">+{coins} moedas</span>
        {boostActive && (
          <span className="flex items-center gap-1 rounded-full border border-[#b69cff]/40 bg-[#b69cff]/10 px-2 py-0.5 text-[10px] font-bold text-[#b69cff]">
            <Zap size={10} fill="currentColor" /> 2x XP
          </span>
        )}
        {rewardCount > 1 && (
          <span className="text-xs text-[var(--text-muted)]">· {rewardCount}× {energyLabel}</span>
        )}
      </div>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onClaim}
        className="rounded-full px-6 py-2 text-sm font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
        style={{ background: accentColor }}
      >
        Resgatar moedas
      </motion.button>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusTimer({ todayStats, history, boostActive, onStart, onEnd }: FocusTimerProps) {
  const [duration, setDuration] = useState(FOCUS_DURATION_DEFAULT_MINUTES);
  const [state, setState] = useState<TimerState>("idle");
  const [remaining, setRemaining] = useState(FOCUS_DURATION_DEFAULT_MINUTES * 60);
  const [lastCoins, setLastCoins] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [rewardModal, setRewardModal] = useState<{ coins: number; xp: number } | null>(null);
  const [rewardCount, setRewardCount] = useState(1);
  const [isExtinguished, setIsExtinguished] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyType>("flame");
  const [showPicker, setShowPicker] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [ownedAuras, setOwnedAuras] = useState<string[]>(["flame", "water"]);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Stable refs — never cause interval restarts
  const sessionRef = useRef<{ id: number; startedAt: number } | null>(null);
  const remainingRef = useRef(FOCUS_DURATION_DEFAULT_MINUTES * 60);
  const remainingMsRef = useRef(FOCUS_DURATION_DEFAULT_MINUTES * 60 * 1000);
  const runningSinceRef = useRef<number | null>(null);
  const stateRef = useRef<TimerState>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedEnergyRef = useRef<EnergyType>("flame");
  const durationRef = useRef(FOCUS_DURATION_DEFAULT_MINUTES);
  const completedRef = useRef(false);
  const soundEnabledRef = useRef(true);

  // Keep refs in sync with state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { selectedEnergyRef.current = selectedEnergy; }, [selectedEnergy]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => {
    durationRef.current = duration;
    if (state === "idle") {
      const totalMs = duration * 60 * 1000;
      remainingMsRef.current = totalMs;
      runningSinceRef.current = null;
      remainingRef.current = duration * 60;
      setRemaining(duration * 60);
    }
  }, [duration, state]);

  // ─── Session Persistence ─────────────────────────────────────────────────────

  // Load persisted session state on mount
  useEffect(() => {
    setMounted(true);
    const persisted = loadSessionState();
    if (!persisted) return;

    // Restore selected energy and duration as defaults
    if (persisted.selectedEnergy) {
      setSelectedEnergy(persisted.selectedEnergy);
      selectedEnergyRef.current = persisted.selectedEnergy;
    }
    if (persisted.durationMinutes && persisted.durationMinutes >= FOCUS_DURATION_MIN_MINUTES && persisted.durationMinutes <= FOCUS_DURATION_MAX_MINUTES) {
      setDuration(persisted.durationMinutes);
      durationRef.current = persisted.durationMinutes;
    }

    // Handle running/paused sessions
    if ((persisted.status === "running" || persisted.status === "paused") && persisted.sessionId) {
      const now = Date.now();
      let remainingMs: number;
      if (typeof persisted.remainingMs === "number" && persisted.remainingMs > 0) {
        remainingMs = persisted.remainingMs;
        if (persisted.status === "running" && typeof persisted.runningSince === "number") {
          remainingMs = Math.max(0, remainingMs - (now - persisted.runningSince));
        }
      } else {
        // Legacy persisted state (before the pause-aware fields existed): fall
        // back to the wall clock of the original session start.
        const elapsedMs = now - (persisted.sessionStartedAt ?? now);
        const totalDurationMs = persisted.durationMinutes * 60 * 1000;
        remainingMs = totalDurationMs - elapsedMs;
      }

      if (remainingMs > 0) {
        // Session still in progress - restore it
        sessionRef.current = { id: persisted.sessionId, startedAt: persisted.sessionStartedAt ?? now };
        remainingMsRef.current = remainingMs;
        runningSinceRef.current = persisted.status === "running" ? now : null;
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        remainingRef.current = remainingSec;
        setRemaining(remainingSec);
        setState(persisted.status as TimerState);
        stateRef.current = persisted.status as TimerState;

        // If it was running, restart the interval after a small delay to ensure refs are set
        if (persisted.status === "running") {
          setTimeout(() => {
            if (stateRef.current === "running") {
              startInterval();
            }
          }, 100);
        }
      } else {
        // Session completed while tab was closed - trigger completion
        // Use a temporary function to handle this case
        const handleCompletedWhileClosed = async (sessionId: number, durationMinutes: number) => {
          try {
            const focusedSeconds = durationMinutes * 60;
            const result = await onEnd(sessionId, focusedSeconds);
            
            setLastCoins(result.xpAwarded);
            setRewardModal({ coins: result.coinsAwarded, xp: result.xpAwarded });
            const reward = getEnergyReward(durationMinutes);
            setRewardCount(reward);
            setShowComplete(true);

            // Multi-layered alerting for a session that ended out of view
            completedRef.current = true;
            if (soundEnabledRef.current) playCompletionSound();
            if (typeof document !== "undefined" && document.hidden) {
              sendSystemCompletionNotification(result.xpAwarded);
              startCompletionTitleFlash();
            }

            // Reset state
            sessionRef.current = null;
            runningSinceRef.current = null;
            setState("idle");
            stateRef.current = "idle";
            remainingRef.current = durationMinutes * 60;
            setRemaining(durationMinutes * 60);
            
            // Clear persistence
            clearSessionState();
          } catch (error) {
            console.error("Failed to handle completed session:", error);
            // On error, reset to idle state but don't show completion
            sessionRef.current = null;
            runningSinceRef.current = null;
            setState("idle");
            stateRef.current = "idle";
            clearSessionState();
          }
        };

        handleCompletedWhileClosed(persisted.sessionId, persisted.durationMinutes);
      }
    } else if (persisted.status === "completed") {
      // Clear completed session state so it doesn't persist indefinitely
      clearSessionState();
    }
  }, []);

  // Save session state on meaningful changes
  useEffect(() => {
    if (!mounted) return;

    const sessionState: PersistedSession = {
      sessionId: sessionRef.current?.id ?? null,
      selectedEnergy: selectedEnergyRef.current,
      durationMinutes: durationRef.current,
      sessionStartedAt: sessionRef.current?.startedAt ?? null,
      remainingMs: remainingMsRef.current,
      runningSince: runningSinceRef.current,
      status: stateRef.current as PersistedSessionState,
      lastUpdatedAt: Date.now(),
    };

    saveSessionState(sessionState);
  }, [state, selectedEnergy, duration, mounted]);

  // Clear persistence when session is completed or cancelled
  useEffect(() => {
    if (state === "idle" && !sessionRef.current) {
      clearSessionState();
    }
  }, [state]);

  // Load owned auras + equipped default from profile
  useEffect(() => {
    api.getStore()
      .then((data) => {
        const owned = data.ownedAuras?.length ? data.ownedAuras : ["flame", "water"];
        setOwnedAuras(owned);

        const persisted = loadSessionState();
        const hasActiveSession =
          persisted &&
          (persisted.status === "running" || persisted.status === "paused") &&
          persisted.sessionId;

        if (!hasActiveSession) {
          const def = resolveDefaultEnergy(owned);
          setSelectedEnergy(def);
          selectedEnergyRef.current = def;
        }
      })
      .catch(() => { /* default owns flame+water */ });
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Load sound preference (defaults to on when it can't be resolved)
  useEffect(() => {
    api.getSettings()
      .then((s) => setSoundEnabled(s.soundNotificationsEnabled))
      .catch(() => { /* keep default: on */ });
  }, []);

  async function activateNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch { /* keep current state */ }
  }

  const totalDurationSec = duration * 60;
  const countdownProgress = Math.min(((totalDurationSec - remaining) / totalDurationSec) * 100, 100);
  const isActive = state !== "idle";
  const isPaused = state === "paused";
  const cfg = ENERGY_CONFIGS[selectedEnergy];
  const imageSize = Math.round(RING_SIZE * 0.58);

  // Wall-clock derived remaining time. The interval is only a render clock —
  // it never decrements a counter, so background-tab throttling/suspension of
  // timers can't make the countdown drift or freeze.
  function computeRemainingMs(): number {
    if (stateRef.current === "running" && runningSinceRef.current != null) {
      return Math.max(0, remainingMsRef.current - (Date.now() - runningSinceRef.current));
    }
    return remainingMsRef.current;
  }

  function sessionExpired(): boolean {
    if (stateRef.current !== "running" || runningSinceRef.current == null) return false;
    return remainingMsRef.current - (Date.now() - runningSinceRef.current) <= 0;
  }

  function syncRemaining(): number {
    const ms = computeRemainingMs();
    remainingRef.current = Math.max(0, Math.ceil(ms / 1000));
    setRemaining(remainingRef.current);
    return ms;
  }

  function startInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (stateRef.current !== "running") return;
      if (sessionExpired()) {
        clearInterval(intervalRef.current!);
        void completeSession();
        return;
      }
      syncRemaining();
      updateCountdownTabTitle(formatTime(remainingRef.current));
    }, 1000);
  }

  // Re-sync the countdown the instant the tab regains focus. Even if the
  // interval was throttled/suspended while backgrounded, the displayed value is
  // recomputed from real wall-clock time (and completion fires) immediately.
  useEffect(() => {
    function resync() {
      if (document.visibilityState !== "visible") return;
      // Restore the tab title the instant the user comes back, even if the
      // completion already fired while hidden (flash is managed internally too).
      restoreTabTitle();
      if (stateRef.current !== "running") return;
      if (sessionExpired()) {
        stopInterval();
        void completeSession();
        return;
      }
      syncRemaining();
      updateCountdownTabTitle(formatTime(remainingRef.current));
    }
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers use stable refs; listeners must be bound only once
  }, []);

  function stopInterval() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function completeSession() {
    const sess = sessionRef.current;
    if (!sess || completedRef.current) return;
    completedRef.current = true;
    stopInterval();

    const focusedSeconds = durationRef.current * 60;
    const focusedMinutes = durationRef.current;

    try {
      const result = await onEnd(sess.id, focusedSeconds);
      setLastCoins(result.xpAwarded);
      setRewardModal({ coins: result.coinsAwarded, xp: result.xpAwarded });

      const reward = getEnergyReward(focusedMinutes);
      setRewardCount(reward);
      setShowComplete(true);

      // Multi-layered alerting — the chime plays regardless of tab focus; the
      // native notification + tab-title flash only apply to out-of-view ends.
      if (soundEnabledRef.current) playCompletionSound();
      if (typeof document !== "undefined" && document.hidden) {
        sendSystemCompletionNotification(result.xpAwarded);
        startCompletionTitleFlash();
      }
    } catch { /* handled by parent */ }

    sessionRef.current = null;
    runningSinceRef.current = null;
    setState("idle");
    stateRef.current = "idle";
    
    // Clear persisted session state on completion
    clearSessionState();
  }

  async function handleStart() {
    // Refresh permission state, but NEVER solicit it here — the contextual
    // in-app prompt (shown while the session runs) drives the actual request.
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
    // Unlock the audio context inside this user gesture so the completion
    // chime is allowed to play when the session ends later in a background tab.
    primeCompletionSound();
    try {
      const result = await onStart(duration, undefined, selectedEnergyRef.current);
      const startedAt = new Date(result.session.startedAt).getTime();
      sessionRef.current = { id: result.session.id, startedAt };

      const totalSec = duration * 60;
      completedRef.current = false;
      remainingMsRef.current = totalSec * 1000;
      runningSinceRef.current = Date.now();
      remainingRef.current = totalSec;
      setRemaining(totalSec);
      setLastCoins(0);
      setShowComplete(false);
      setIsExtinguished(false);
      setPromptDismissed(false);

      setState("running");
      stateRef.current = "running";
      startInterval();
      
      // Persistence is handled by the useEffect that watches state changes
    } catch { /* handled by parent */ }
  }

  function handlePause() {
    if (state !== "running") return;
    // Freeze the remaining time at this instant; the run segment is over.
    remainingMsRef.current = computeRemainingMs();
    runningSinceRef.current = null;
    setState("paused");
    stateRef.current = "paused";
  }

  function handleResume() {
    if (state !== "paused") return;
    // Start a fresh run segment; remaining continues from the frozen value.
    runningSinceRef.current = Date.now();
    setState("running");
    stateRef.current = "running";
  }

  async function handleStop(giveUp = false) {
    stopInterval();
    if (giveUp) setIsExtinguished(true);

    const sess = sessionRef.current;
    completedRef.current = false;
    restoreTabTitle();
    if (!sess) { setState("idle"); return; }

    // Capture the remaining time BEFORE clearing the run-segment timestamp so
    // the currently-running segment's elapsed seconds aren't lost.
    const focusedMs = durationRef.current * 60 * 1000 - computeRemainingMs();
    const focusedSeconds = Math.max(0, Math.ceil(focusedMs / 1000));
    runningSinceRef.current = null;

    try {
      const result = await onEnd(sess.id, focusedSeconds);
      if (!giveUp) {
        setLastCoins(result.xpAwarded);
        setRewardModal({ coins: result.coinsAwarded, xp: result.xpAwarded });
        setRewardCount(getEnergyReward(Math.floor(focusedSeconds / 60)));
        setShowComplete(true);
      }
    } catch { /* handled by parent */ }

    sessionRef.current = null;
    setState("idle");
    stateRef.current = "idle";
    remainingRef.current = durationRef.current * 60;
    setRemaining(durationRef.current * 60);
    setIsExtinguished(false);   // always clear so idle shows full-stage preview
    
    // Clear persisted session state on stop/cancel
    clearSessionState();
  }

  // Cleanup on unmount
  useEffect(() => () => stopInterval(), []);

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">FOCO</span>
        </div>
        {/* Notification permission — manual opt-in, never requested on load */}
        {notifPermission === "default" && (
          <button
            onClick={() => void activateNotifications()}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] transition"
          >
            <Bell size={10} /> Ativar notificações
          </button>
        )}
      </div>

      <div className="flex flex-col items-center">
        {/* Ring */}
        <div className="relative mx-auto" style={{ width: RING_SIZE, maxWidth: "100%", aspectRatio: "1 / 1" }}>
          {state === "idle" ? (
            <CircularDurationPicker
              value={duration}
              onChange={setDuration}
              maxDurationMinutes={FOCUS_DURATION_MAX_MINUTES}
              snapIncrement={FOCUS_DURATION_SNAP_MINUTES}
              minMinutes={FOCUS_DURATION_MIN_MINUTES}
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

          {/* Center energy image with smooth crossfade animations */}
          <GrowingEnergyIcon
            energyType={selectedEnergy}
            ringSize={RING_SIZE}
            elapsedSeconds={isActive ? totalDurationSec - remaining : 0}
            totalSeconds={totalDurationSec}
            previewFullStage={!isActive}
            extinguished={isExtinguished}
            dimmed={isExtinguished}
            showCluster={showComplete && rewardCount > 1}
            clusterCount={rewardCount}
            onPick={state === "idle" ? () => setShowPicker(true) : undefined}
          />
        </div>

        {/* "toque para trocar" hint — sits below the ring, never overlaps the image */}
        {state === "idle" && (
          <div className="mt-3 flex items-center justify-center">
            <span className="text-[9px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
              toque para trocar
            </span>
          </div>
        )}

        <FocusDurationReadout
          minutes={duration}
          remainingSeconds={remaining}
          active={isActive}
          paused={isPaused}
          fontSize={44}
        />

        {/* Contextual notification prompt — only after a session starts, with an
            in-app explanation BEFORE the actual browser permission request */}
        {state === "running" && notifPermission === "default" && !promptDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mt-3 flex w-full max-w-sm items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2.5"
          >
            <Bell size={14} className="shrink-0 text-[var(--accent)]" />
            <p className="flex-1 text-[10px] leading-snug text-[var(--text-muted)]">
              Quer receber uma notificação quando sua sessão de foco terminar?
            </p>
            <button
              onClick={() => void activateNotifications()}
              className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              style={{ background: cfg.accent }}
            >
              Ativar
            </button>
            <button
              onClick={() => setPromptDismissed(true)}
              className="shrink-0 text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
            >
              Agora não
            </button>
          </motion.div>
        )}

        {/* Coins preview */}
        {!isActive && !showComplete && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
            <CoinIcon size={12} />
            <span>{calculateCoins(duration)} moedas se completar</span>
          </div>
        )}

        {/* Completion banner with claim button */}
        <AnimatePresence>
          {showComplete && (
            <CompletionBanner
              coins={lastCoins}
              rewardCount={rewardCount}
              energyLabel={cfg.label}
              accentColor={cfg.accent}
              boostActive={boostActive}
              onClaim={() => setShowComplete(false)}
            />
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="mt-4 flex justify-center gap-2">
          {state === "idle" && !showComplete && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleStart}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
              style={{ background: cfg.accent, transition: "background-color 0.4s ease, opacity 0.2s" }}
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
                style={{ background: cfg.accent, transition: "background-color 0.4s ease, opacity 0.2s" }}>
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

      {/* Today stats */}
      <div className="grid grid-cols-2 gap-2 mt-6">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold" style={{ color: cfg.accent, transition: "color 0.4s ease" }}>{Math.floor(todayStats.minutesFocused / 60)}h{todayStats.minutesFocused % 60 > 0 ? ` ${todayStats.minutesFocused % 60}min` : ""}</div>
          <div className="text-[10px] text-[var(--text-faint)]">foco hoje</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-lg font-mono font-bold text-[#ffb86b]">
            <CoinIcon size={15} />
            {todayStats.coinsEarned}
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">moedas hoje</div>
        </div>
      </div>

      {/* Recent sessions */}
      {history.length > 0 && (
        <div className="mt-4">
          <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Sessões recentes</span>
          <div className="mt-2 space-y-1">
            {history.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[10px] py-1">
                <span className="text-[var(--text-muted)]">{Math.floor(s.durationMinutes / 60)}h{s.durationMinutes % 60 > 0 ? ` ${s.durationMinutes % 60}min` : ""}</span>
                <span className="text-[#ffb86b] font-mono">+{s.xpEarned}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Energy picker modal */}
      <RewardClaimModal reward={rewardModal} onClose={() => setRewardModal(null)} />

      {showPicker && (
        <EnergyPickerModal
          current={selectedEnergy}
          ownedAuras={new Set(ownedAuras)}
          onSelect={setSelectedEnergy}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
