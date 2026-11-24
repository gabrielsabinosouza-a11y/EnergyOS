"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Timer, Bell } from "lucide-react";
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
import { focusCoinsForDuration } from "@/lib/daily-limits";
import { EnergyPickerModal } from "@/components/energy-picker-modal";
import { GrowingEnergyIcon } from "@/components/growing-energy-icon";
import { AuraStageImage, StageBurst } from "@/components/aura-stage-image";
import { SessionCelebration } from "@/components/dashboard/session-celebration";
import {
  claimPendingCelebration,
  clearPendingCelebration,
  markCelebrationPending,
  type PendingCelebration,
} from "@/lib/celebration";
import { formatDurationPt } from "@/lib/design-tokens";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ENERGY_CONFIGS, resolveDefaultEnergy, type EnergyType } from "@/lib/energy-assets";
import { getGrowthStage, sessionTreeAuraId, type TimerGrowthStage } from "@/lib/focus-growth";
import { preloadAuraStageImages } from "@/lib/aura-images";
import { api } from "@/lib/api-client";
import {
  playCompletionSound,
  primeCompletionSound,
  restoreTabTitle,
  sendSystemCompletionNotification,
  startCompletionTitleFlash,
  updateCountdownTabTitle,
} from "@/lib/session-alerts";
import { ambientEngine } from "@/lib/ambient-sounds/engine";
import { AmbientSoundButton } from "@/components/dashboard/ambient-sound-button";
import {
  focusPhaseAt,
  GRACE_PERIOD_SECONDS,
  type FocusSessionEndReason,
} from "@/../apps/mobile/src/shared/focus-session-state";

// ─── Session Persistence Types ───────────────────────────────────────────────

type PersistedSessionState = "idle" | "running" | "paused" | "completed";

interface PersistedSession {
  sessionId: number | null;
  selectedEnergy: EnergyType;
  /** Aura equipped when the session started — the session's tree. Frozen so
   *  changing the equipped aura mid-session (or before a reload) never
   *  rewrites an ongoing session. */
  sessionAuraId?: string | null;
  durationMinutes: number;
  sessionStartedAt: number | null; // timestamp in ms
  remainingMs: number | null; // remaining ms as of the start of the current run segment (frozen while paused)
  runningSince: number | null; // timestamp in ms when the current running segment began (null while paused)
  status: PersistedSessionState;
  lastUpdatedAt: number; // timestamp in ms
  pausedCount: number; // number of times the user paused this session
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
  return focusCoinsForDuration(durationMinutes);
}

/**
 * Development-only timer speed: `?timerSpeed=N` (e.g. ?timerSpeed=60) scales
 * the elapsed/remaining wall clock by N so stages and completion can be
 * exercised without waiting 25 minutes. Enabled only outside production.
 */
function readTimerSpeedMultiplier(): number {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("timerSpeed");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
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
  onEnd: (sessionId: number, focusedSeconds: number, pausedCount?: number, endReason?: FocusSessionEndReason) => Promise<{ session: FocusSession; xpAwarded: number; coinsAwarded: number; streak?: { previousStreak: number; currentStreak: number } | null }>;
  onCancel: (sessionId: number) => Promise<void>;
  onPause: (sessionId: number) => Promise<void>;
  onResume: (sessionId: number) => Promise<void>;
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
  // Bright head dot at the arc tip.
  const headAngle = ((progress / 100) * 360 - 90) * (Math.PI / 180);
  const headX = cx + radius * Math.cos(headAngle);
  const headY = cy + radius * Math.sin(headAngle);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: "100%", height: "auto", display: "block" }}>
      <defs>
        <filter id="countdown-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Higher-contrast track so the ring reads as a progress instrument. */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border-strong)" strokeWidth={8} opacity={0.6} />
      <circle
        cx={cx} cy={cy} r={radius} fill="none"
        stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: "url(#countdown-glow)", transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
      />
      {progress > 0.5 && progress < 99.5 && (
        <g filter="url(#countdown-glow)">
          <circle cx={headX} cy={headY} r={9} fill={color} opacity={0.3} />
          <circle cx={headX} cy={headY} r={4.5} fill="#ffffff" />
        </g>
      )}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusTimer({ todayStats, history, onStart, onEnd, onCancel, onPause, onResume }: FocusTimerProps) {
  const [duration, setDuration] = useState(FOCUS_DURATION_DEFAULT_MINUTES);
  const [state, setState] = useState<TimerState>("idle");
  const [remaining, setRemaining] = useState(FOCUS_DURATION_DEFAULT_MINUTES * 60);
  const [celebration, setCelebration] = useState<PendingCelebration | null>(null);
  const [isExtinguished, setIsExtinguished] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyType>("flame");
  const [showPicker, setShowPicker] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [ownedAuras, setOwnedAuras] = useState<string[]>(["flame", "water"]);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [cancelNotice, setCancelNotice] = useState("");
  const [giveUpNotice, setGiveUpNotice] = useState("");
  const [actionError, setActionError] = useState("");
  // Growth stages of the timer's tree: begin → mid → full while focusing,
  // die when the user gives up. Derived from wall-clock elapsed (server-stamped
  // session start), not a counter — survives reloads and throttling.
  const [growthStage, setGrowthStage] = useState<TimerGrowthStage | "die">("begin");
  const [stageBurst, setStageBurst] = useState<{ kind: "small" | "big"; id: number } | null>(null);
  const [stageEnter, setStageEnter] = useState(0);

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
  const pausedCountRef = useRef(0);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedScaleRef = useRef(1);
  const growthAuraRef = useRef<string | null>(null);
  const stageBurstSeqRef = useRef(0);
  const prevStageRef = useRef<TimerGrowthStage | "die" | null>(null);

  // Keep refs in sync with state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { selectedEnergyRef.current = selectedEnergy; }, [selectedEnergy]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // Dev-only timer speed (see readTimerSpeedMultiplier).
  useEffect(() => { elapsedScaleRef.current = readTimerSpeedMultiplier(); }, []);

  // Preload the coin sprite once so the collect animation never flickers.
  useEffect(() => {
    const img = new window.Image();
    img.src = "/coin/coins.png";
  }, []);

  // Stage transitions: small burst at mid, big celebration at completion/full.
  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = growthStage;
    if (!prev) return; // initial mount
    if (growthStage === "mid" && prev !== "mid") {
      setStageBurst({ kind: "small", id: ++stageBurstSeqRef.current });
    } else if (growthStage === "full" && prev !== "full") {
      setStageBurst({ kind: "big", id: ++stageBurstSeqRef.current });
    }
  }, [growthStage]);

  // Bursts auto-fade out after a while.
  useEffect(() => {
    if (!stageBurst) return;
    const t = setTimeout(() => setStageBurst(null), stageBurst.kind === "big" ? 1200 : 900);
    return () => clearTimeout(t);
  }, [stageBurst]);

  // Pick a new aura: update the timer state immediately and persist the choice
  // (fire-and-forget) so the next visit restores the same aura — ownership is
  // already guaranteed by the picker, which disables non-owned types.
  const selectEnergy = (type: EnergyType) => {
    setSelectedEnergy(type);
    selectedEnergyRef.current = type;
    // Falhas NÃO são mais silenciosas: escolhas que "sumiam" no reload eram
    // invisíveis com o catch vazio (todas as linhas de last_selected_aura
    // estavam null no banco sem nenhum sinal de erro).
    api.updateLastSelectedAura(type).catch((err: unknown) => {
      console.warn("[focus-timer] não foi possível persistir a aura escolhida:", err);
    });
  };
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
      pausedCountRef.current = typeof persisted.pausedCount === "number" ? persisted.pausedCount : 0;
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
        // The tree aura is the one equipped when the session STARTED (stored
        // server-side on the session and mirrored here), not whatever aura is
        // equipped now.
        growthAuraRef.current = persisted.sessionAuraId ?? persisted.selectedEnergy ?? selectedEnergyRef.current;
        preloadAuraStageImages(growthAuraRef.current);
        remainingMsRef.current = remainingMs;
        runningSinceRef.current = persisted.status === "running" ? now : null;
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        remainingRef.current = remainingSec;
        setRemaining(remainingSec);
        setState(persisted.status as TimerState);
        stateRef.current = persisted.status as TimerState;
        // Ambient sounds: mark the session as running, but playback still
        // waits for the first user gesture (browser autoplay policy).
        if (persisted.status === "running" || persisted.status === "paused") {
          ambientEngine.setSessionRunning(true);
          ambientEngine.setPaused(persisted.status === "paused");
        }
        // Restore the correct growth stage from the server-stamped start.
        updateGrowthStage();

        // If it was running, restart the interval after a small delay to ensure refs are set
        if (persisted.status === "running") {
          setTimeout(() => {
            if (stateRef.current === "running") {
              startInterval();
              updateGrowthStage();
            }
          }, 100);
        }
      } else {
        // Session completed while tab was closed - trigger completion
        // Use a temporary function to handle this case
        const handleCompletedWhileClosed = async (sessionId: number, durationMinutes: number) => {
          try {
            const focusedSeconds = durationMinutes * 60;
            const result = await onEnd(sessionId, focusedSeconds, pausedCountRef.current, "completed");
            presentCelebration({
              sessionId,
              coins: result.coinsAwarded,
              xp: result.xpAwarded,
              durationMinutes,
              streakPrevious: result.streak?.previousStreak,
              streakCurrent: result.streak?.currentStreak,
              auraId: growthAuraRef.current,
            });

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
      sessionAuraId: growthAuraRef.current,
      durationMinutes: durationRef.current,
      sessionStartedAt: sessionRef.current?.startedAt ?? null,
      remainingMs: remainingMsRef.current,
      runningSince: runningSinceRef.current,
      status: stateRef.current as PersistedSessionState,
      lastUpdatedAt: Date.now(),
      pausedCount: pausedCountRef.current,
    };

    saveSessionState(sessionState);
  }, [state, selectedEnergy, duration, mounted]);

  // Clear persistence when session is completed or cancelled
  useEffect(() => {
    if (state === "idle" && !sessionRef.current) {
      clearSessionState();
    }
  }, [state]);

  // Load owned auras + equipped default from profile. Zero-in on the user's
  // persisted last-picked aura when it's still owned/available; otherwise fall
  // back to the default (flame or first owned) so the screen never breaks.
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

        if (hasActiveSession) return;
        // Precedência ao restaurar: (1) aura persistida no Neon; (2) última
        // escolha LOCAL desta máquina (localStorage da sessão — cobre o caso de
        // o PATCH ter falhado); (3) default (flame ou primeira owned). O fluxo
        // anterior ignorava (2) e sobrescrevia a escolha do usuário com flame
        // sempre que o banco ainda não tinha valor.
        const localChoice = persisted?.selectedEnergy;
        const localFallback =
          localChoice && owned.includes(localChoice) && ENERGY_CONFIGS[localChoice]
            ? localChoice
            : resolveDefaultEnergy(owned);
        api.getSettings()
          .then((s) => {
            const saved = s.lastSelectedAura as EnergyType | undefined;
            const next = saved && owned.includes(saved) && ENERGY_CONFIGS[saved] ? saved : localFallback;
            setSelectedEnergy(next);
            selectedEnergyRef.current = next;
          })
          .catch((err: unknown) => {
            console.warn("[focus-timer] falha ao carregar a aura persistida:", err);
            setSelectedEnergy(localFallback);
            selectedEnergyRef.current = localFallback;
          });
      })
      .catch((err: unknown) => {
        console.warn("[focus-timer] falha ao carregar auras owned:", err);
      });
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
  const isGracePeriod = state === "running" && !!sessionRef.current &&
    focusPhaseAt(sessionRef.current.startedAt, Date.now()) === "grace_period";
  const graceSecondsRemaining = sessionRef.current
    ? Math.max(0, Math.ceil((GRACE_PERIOD_SECONDS * 1000 - (Date.now() - sessionRef.current.startedAt)) / 1000))
    : 0;
  const graceProgress = Math.max(0, Math.min(1, graceSecondsRemaining / GRACE_PERIOD_SECONDS));
  const sessionStatusText = state === "idle"
    ? "RITMO NO SEU TEMPO"
    : isGracePeriod
      ? "PERÍODO DE CANCELAMENTO"
      : isPaused
        ? "PAUSADO"
        : "EM ANDAMENTO";
  const cfg = ENERGY_CONFIGS[selectedEnergy];
  // Aura occupies ~56% of the ring diameter, centered inside it.
  const imageSize = Math.round(RING_SIZE * 0.56);
  // Visual tree stage during the session: begin → mid → full. After a give-up
  // the dead tree stays visible while idle (die), otherwise idle previews full.
  const visualStage: TimerGrowthStage | "die" = isActive
    ? growthStage
    : growthStage === "die" ? "die" : "full";
  // The tree is the aura equipped when the session started (frozen in
  // growthAuraRef / persisted as sessionAuraId), so swapping the equipped
  // aura mid-session never changes an ongoing or past session's tree.
  const treeAuraId = sessionTreeAuraId(
    isActive || visualStage === "die" ? growthAuraRef.current : null,
    selectedEnergy,
  );
  const treeCfg = ENERGY_CONFIGS[treeAuraId as EnergyType] ?? cfg;

  // Wall-clock derived remaining time. The interval is only a render clock —
  // it never decrements a counter, so background-tab throttling/suspension of
  // timers can't make the countdown drift or freeze.
  function computeRemainingMs(): number {
    if (stateRef.current === "running" && runningSinceRef.current != null) {
      return Math.max(0, remainingMsRef.current - (Date.now() - runningSinceRef.current) * elapsedScaleRef.current);
    }
    return remainingMsRef.current;
  }

  // Stage from the session's start timestamp — wall-clock based, so it
  // survives reloads, throttling and tab switches. Not a client-side counter.
  function updateGrowthStage(): void {
    if (!sessionRef.current) return;
    const totalMs = durationRef.current * 60 * 1000;
    const stage = getGrowthStage(totalMs - computeRemainingMs(), totalMs);
    setGrowthStage((prev) => (prev === stage ? prev : stage));
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
      syncRemaining();
      updateGrowthStage();
      if (sessionExpired()) {
        clearInterval(intervalRef.current!);
        void completeSession();
        return;
      }
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
      updateGrowthStage();
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

  /**
   * Reward was already granted server-side by onEnd (idempotent). Here we only
   * present it: persist a "pending celebration" flag so a reload/hidden tab/
   * second device still sees it once, then claim it immediately when the tab
   * is visible so it can't be claimed twice.
   */
  function presentCelebration(data: Omit<PendingCelebration, "createdAt">) {
    markCelebrationPending(data);
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      const claimed = claimPendingCelebration();
      if (claimed) setCelebration(claimed);
    }
  }

  // Claim a pending celebration on mount (session completed while the tab was
  // closed/reloaded) — shown once, then the flag is consumed. Deferred a tick
  // so session restore settles first and to avoid a synchronous setState in
  // the effect body.
  useEffect(() => {
    const t = setTimeout(() => {
      if (celebration || stateRef.current !== "idle" || sessionRef.current) return;
      const pending = claimPendingCelebration();
      if (pending) setCelebration(pending);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after mount/restore settles
  }, [mounted]);

  // Same claim when the tab becomes visible again (completion happened while
  // the tab was in the background).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible" || celebration || stateRef.current !== "idle" || sessionRef.current) return;
      const pending = claimPendingCelebration();
      if (pending) setCelebration(pending);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [celebration]);

  // Cross-tab dedupe is handled inside claimPendingCelebration(): the pending
  // flag is removed and a per-session "seen" marker is written synchronously,
  // so a second tab mounting at the same time gets null and shows nothing.

  async function completeSession() {
    const sess = sessionRef.current;
    if (!sess || completedRef.current) return;
    completedRef.current = true;
    stopInterval();
    // Ambient bed fades out slowly (~3s) under the celebration; the gentle
    // completion chime keeps its own schedule below.
    ambientEngine.fadeOutFinish();

    const focusedSeconds = durationRef.current * 60;
    const focusedMinutes = durationRef.current;

    try {
      const result = await onEnd(sess.id, focusedSeconds, pausedCountRef.current, "completed");
      presentCelebration({
        sessionId: sess.id,
        coins: result.coinsAwarded,
        xp: result.xpAwarded,
        durationMinutes: focusedMinutes,
        streakPrevious: result.streak?.previousStreak,
        streakCurrent: result.streak?.currentStreak,
        auraId: growthAuraRef.current,
      });

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
    setGrowthStage("full");

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
    // Unlock the ambient AudioContext inside the same gesture (autoplay-safe).
    ambientEngine.prime();
    try {
      const result = await onStart(duration, undefined, selectedEnergyRef.current);
      const startedAt = new Date(result.session.startedAt).getTime();
      sessionRef.current = { id: result.session.id, startedAt };
      // The aura equipped when the session starts is the tree for this run.
      growthAuraRef.current = result.session.energyType ?? selectedEnergyRef.current;
      stageBurstSeqRef.current = 0;
      setStageBurst(null);
      setGrowthStage("begin");
      preloadAuraStageImages(growthAuraRef.current);

      const totalSec = duration * 60;
      completedRef.current = false;
      pausedCountRef.current = 0;
      remainingMsRef.current = totalSec * 1000;
      runningSinceRef.current = Date.now();
      remainingRef.current = totalSec;
      setRemaining(totalSec);
      setCelebration(null);
      setIsExtinguished(false);
      setPromptDismissed(false);

      setState("running");
      stateRef.current = "running";
      startInterval();
      ambientEngine.setSessionRunning(true);

      // Persistence is handled by the useEffect that watches state changes
    } catch { /* handled by parent */ }
  }

  async function handlePause() {
    if (state !== "running") return;
    const sess = sessionRef.current;
    if (!sess) return;
    setActionError("");
    try {
      await onPause(sess.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível pausar a sessão.");
      return;
    }
    // Freeze the remaining time at this instant; the run segment is over.
    remainingMsRef.current = computeRemainingMs();
    runningSinceRef.current = null;
    pausedCountRef.current += 1;
    setState("paused");
    stateRef.current = "paused";
    ambientEngine.setPaused(true);
  }

  async function handleResume() {
    if (state !== "paused") return;
    const sess = sessionRef.current;
    if (!sess) return;
    setActionError("");
    try {
      await onResume(sess.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível retomar a sessão.");
      return;
    }
    // Start a fresh run segment; remaining continues from the frozen value.
    runningSinceRef.current = Date.now();
    setState("running");
    stateRef.current = "running";
    ambientEngine.setPaused(false);
  }

  async function handleCancel() {
    const sess = sessionRef.current;
    if (!sess || !isGracePeriod) return;
    setActionError("");
    try {
      await onCancel(sess.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível cancelar a sessão.");
      return;
    }
    stopInterval();
    completedRef.current = false;
    restoreTabTitle();
    ambientEngine.fadeOutQuick();
    sessionRef.current = null;
    runningSinceRef.current = null;
    setState("idle");
    stateRef.current = "idle";
    setGrowthStage("full");
    remainingRef.current = durationRef.current * 60;
    setRemaining(durationRef.current * 60);
    clearSessionState();
    setCancelNotice("Sessão cancelada");
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setCancelNotice(""), 2500);
  }

  async function confirmGiveUp() {
    stopInterval();
    const sess = sessionRef.current;
    completedRef.current = false;
    restoreTabTitle();
    setShowGiveUpConfirm(false);
    setActionError("");
    if (!sess) return;

    // Capture the remaining time BEFORE clearing the run-segment timestamp so
    // the currently-running segment's elapsed seconds aren't lost.
    const focusedMs = durationRef.current * 60 * 1000 - computeRemainingMs();
    const focusedSeconds = Math.max(0, Math.ceil(focusedMs / 1000));
    runningSinceRef.current = null;

    try {
      await onEnd(sess.id, focusedSeconds, pausedCountRef.current, "gave_up");
      // Give-ups award nothing — make sure no stale celebration flag replays.
      clearPendingCelebration();
      // Ambient bed fades quickly; silence matches the dead-tree moment.
      ambientEngine.fadeOutQuick();
      setIsExtinguished(true);
      setGiveUpNotice("Você consegue mais na próxima.");
      // Shake + crossfade to the dead tree.
      setGrowthStage("die");
      setStageEnter((e) => e + 1);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = setTimeout(() => {
        setIsExtinguished(false);
        setGiveUpNotice("");
        // Revert the dead tree to the normal idle preview so the aura picker
        // (reachable only from the idle preview) works again.
        setGrowthStage("full");
      }, 3500);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível desistir da sessão.");
      runningSinceRef.current = stateRef.current === "running" ? Date.now() : null;
      startInterval();
      return;
    }

    sessionRef.current = null;
    setState("idle");
    stateRef.current = "idle";
    remainingRef.current = durationRef.current * 60;
    setRemaining(durationRef.current * 60);
    // Clear persisted session state on stop/cancel
    clearSessionState();
  }

  // Cleanup on unmount — also hard-stop every ambient source so nothing
  // keeps playing orphaned after the card is gone.
  useEffect(() => () => {
    stopInterval();
    ambientEngine.stopAll();
  }, []);
  useEffect(() => () => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
  }, []);

  return (
    <div className="panel relative isolate overflow-hidden bg-[color-mix(in_srgb,var(--bg-surface)_92%,transparent)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_18px_44px_-34px_rgba(0,0,0,.9)] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-300/[.035] blur-3xl" />
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">FOCO</span>
        </div>
        {/* Notification permission — manual opt-in, never requested on load */}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {notifPermission === "default" && (
            <button
              onClick={() => void activateNotifications()}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] text-[var(--text-faint)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Bell size={10} /> Ativar notificações
            </button>
          )}
          <AmbientSoundButton sessionActive={isActive} />
        </div>
      </div>

      <div className="flex flex-col items-center">
        {celebration ? (
          <SessionCelebration
            data={celebration}
            accentColor={cfg.accent}
            onDone={() => setCelebration(null)}
          />
        ) : (
        /* Ring */
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

          {/* Center tree image: stage image (begin/mid/full), bursts on growth,
              shake + die crossfade on give-up; legacy spark/full preview when idle. */}
          {(isActive || visualStage === "die") ? (
            <AuraStageImage
              auraId={treeAuraId}
              stage={visualStage}
              cfg={treeCfg}
              label={treeCfg.label}
              size={imageSize}
              enterKey={`${visualStage}-${stageEnter}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                marginLeft: -imageSize / 2,
                marginTop: -imageSize / 2,
              }}
            />
          ) : (
            <GrowingEnergyIcon
              energyType={selectedEnergy}
              ringSize={RING_SIZE}
              elapsedSeconds={0}
              totalSeconds={totalDurationSec}
              previewFullStage
              extinguished={isExtinguished}
              dimmed={isExtinguished}
              onPick={() => setShowPicker(true)}
            />
          )}
          {stageBurst && <StageBurst kind={stageBurst.kind} />}
        </div>
        )}

        {state === "idle" && !celebration && (
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Arraste o aro para definir a duração</p>
        )}

        {!celebration && (
        <FocusDurationReadout
          minutes={duration}
          remainingSeconds={remaining}
          active={isActive}
          paused={isPaused}
          runningLabel={sessionStatusText}
          fontSize={44}
        />
        )}

        {/* Contextual notification prompt — only after a session starts, with an
            in-app explanation BEFORE the actual browser permission request */}
        {state === "running" && !isGracePeriod && notifPermission === "default" && !promptDismissed && (
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
        {!isActive && !celebration && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
            <CoinIcon size={12} />
            <span>{calculateCoins(duration)} moedas se completar</span>
          </div>
        )}

        {/* Action buttons */}
        {!celebration && (
        <div className="mt-4 flex min-h-11 justify-center gap-2">
          {state === "idle" && (
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
              {!isGracePeriod && (
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => void handlePause()}
                  aria-label="Pausar sessão de foco"
                  className="flex items-center gap-2 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-[var(--text)] hover:bg-[var(--bg-surface-active)] transition-colors">
                  <Pause size={14} /> Pausar
                </motion.button>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.button
                  key={isGracePeriod ? "cancel" : "give-up"}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.16 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => isGracePeriod ? void handleCancel() : setShowGiveUpConfirm(true)}
                  aria-label={isGracePeriod
                    ? `Cancelar sessão sem penalidade, ${graceSecondsRemaining} segundos restantes`
                    : "Desistir da sessão de foco"}
                  className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                    isGracePeriod
                      ? "border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text)]"
                      : "bg-[#ff9c6b] text-[var(--bg-primary)] hover:bg-[#ff815d]"
                  }`}
                >
                  {isGracePeriod ? (
                    <>
                      <span>Cancelar ({graceSecondsRemaining}s)</span>
                      <svg aria-hidden="true" className="-mr-1 h-5 w-5 -rotate-90" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
                        <circle
                          cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeDasharray={`${2 * Math.PI * 9 * graceProgress} ${2 * Math.PI * 9}`}
                          strokeLinecap="round"
                        />
                      </svg>
                    </>
                  ) : (
                    <>
                      <Square size={12} fill="currentColor" /> Desistir
                    </>
                  )}
                </motion.button>
              </AnimatePresence>
            </>
          )}

          {state === "paused" && (
            <>
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => void handleResume()}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
                style={{ background: cfg.accent, transition: "background-color 0.4s ease, opacity 0.2s" }}>
                <Play size={14} fill="currentColor" /> Continuar
              </motion.button>
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowGiveUpConfirm(true)}
                aria-label="Desistir da sessão pausada"
                className="flex items-center gap-2 rounded-full bg-[#ff9c6b] px-4 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity">
                <Square size={12} fill="currentColor" /> Desistir
              </motion.button>
            </>
          )}
        </div>
        )}
        {actionError && <p role="alert" className="mt-2 text-center text-xs text-red-300">{actionError}</p>}
        <AnimatePresence>
          {(cancelNotice || giveUpNotice) && (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-center text-xs text-[var(--text-muted)]"
            >
              {cancelNotice || giveUpNotice}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Today stats - responsive grid */}
      <div className="grid grid-cols-2 gap-2 mt-4 sm:mt-6">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold" style={{ color: cfg.accent, transition: "color 0.4s ease" }}>{formatDurationPt(todayStats.minutesFocused)}</div>
          <div className="text-[10px] text-[var(--text-faint)]">foco hoje</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-lg font-mono font-bold text-[#ffb86b]">
            <CoinIcon size={15} />
            <AnimatedNumber value={todayStats.coinsEarned} />
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">moedas hoje</div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="mt-4">
        <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Sessões recentes</span>
        {history.length > 0 ? (
          <div className="mt-2 space-y-1">
            {history.slice(0, 3).map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-between text-[10px] py-1"
              >
                <span className={s.endReason === "gave_up" ? "text-[var(--text-faint)]" : "text-[var(--text-muted)]"}>
                  {s.endReason === "gave_up" ? "💔 " : ""}
                  {formatDurationPt(s.durationMinutes)}
                  {s.endReason === "gave_up" ? " · Desistiu" : ""}
                </span>
                <span className={`flex items-center gap-1 font-mono ${s.endReason === "gave_up" ? "text-[var(--text-faint)]" : "text-[#ffb86b]"}`}>
                  <CoinIcon size={11} />+{s.endReason === "gave_up" ? 0 : s.xpEarned}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/60 px-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)]">
              <Timer size={14} className="text-[var(--accent)]" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Nenhuma sessão ainda</p>
              <p className="text-[10px] text-[var(--text-faint)]">Arraste o aro e inicie seu primeiro foco</p>
            </div>
          </div>
        )}
      </div>

      {/* Energy picker modal */}

      <AnimatePresence>
        {showGiveUpConfirm && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowGiveUpConfirm(false);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="focus-giveup-title"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101b2b] p-5 shadow-2xl"
            >
              <h2 id="focus-giveup-title" className="text-center text-base font-semibold text-[var(--text)]">
                Tem certeza que quer desistir? Sua energia vai se apagar. 💔
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  autoFocus
                  onClick={() => setShowGiveUpConfirm(false)}
                  className="rounded-xl bg-[var(--accent)] px-3 py-3 text-sm font-bold text-[var(--bg-primary)]"
                >
                  Continuar focando
                </button>
                <button
                  onClick={() => void confirmGiveUp()}
                  className="rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-3 text-sm font-bold text-red-200"
                >
                  Desistir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPicker && (
        <EnergyPickerModal
          current={selectedEnergy}
          ownedAuras={new Set(ownedAuras)}
          onSelect={selectEnergy}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
