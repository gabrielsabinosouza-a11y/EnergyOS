"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthRedirect } from "@/lib/auth-context";
import {
  Plus,
  X,
  Check,
  Clock,
  Users,
  Play,
  Pause,
  Copy,
  Share2,
  CheckCircle,
  Loader2,
  ChevronLeft,
  Sparkles,
  Trash2,
  UserPlus,
  Square,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { CoinIcon } from "@/components/coin-icon";
import { EnergyPickerModal } from "@/components/energy-picker-modal";
import { EnergyRingCenter } from "@/components/energy-ring-center";
import { Modal } from "@/components/modal";
import { ShareRoomModal } from "@/components/share-room-modal";
import { api } from "@/lib/api-client";
import type { FocusRoom } from "@/lib/db/focus-rooms";
import { ENERGY_CONFIGS, ENERGY_TYPES, resolveDefaultEnergy, type EnergyType } from "@/lib/energy-assets";
import { CircularDurationPicker, FocusDurationReadout } from "@/components/dashboard/circular-duration-picker";
import {
  FOCUS_DURATION_DEFAULT_MINUTES,
  FOCUS_DURATION_MAX_MINUTES,
  FOCUS_DURATION_MIN_MINUTES,
  FOCUS_DURATION_SNAP_MINUTES,
  focusDurationProgress,
  formatCountdownMmSs,
} from "@/lib/focus-duration";

type PageState = "list" | "create" | "join" | "room";

const DEFAULT_DURATION = FOCUS_DURATION_DEFAULT_MINUTES;
const CREATE_RING_SIZE = 210;
const JOIN_RING_SIZE = 120;
const POLL_INTERVAL_MS = 4000;
const ROOM_SESSION_KEY = (roomId: number) => `energyos_room_session_${roomId}`;

interface PersistedRoomSession {
  sessionId: number;
  created: string;
  finalized: boolean;
}

function saveRoomSession(roomId: number, s: PersistedRoomSession) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(ROOM_SESSION_KEY(roomId), JSON.stringify(s)); } catch { /* ignore */ }
}
function loadRoomSession(roomId: number): PersistedRoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROOM_SESSION_KEY(roomId));
    return raw ? JSON.parse(raw) as PersistedRoomSession : null;
  } catch { return null; }
}

function formatTime(totalSeconds: number): string {
  return formatCountdownMmSs(totalSeconds);
}

// ─── Small avatar with optional energy badge ─────────────────────────────────

function RoomAvatar({
  profile,
  energyType,
  size = 40,
  muted = false,
  dimmed = false,
}: {
  profile?: { id: string; displayName: string; photoUrl?: string };
  energyType?: string | null;
  size?: number;
  muted?: boolean;
  dimmed?: boolean;
}) {
  const displayName = profile?.displayName || "Anônimo";
  const initials = displayName.charAt(0).toUpperCase();
  const cfg = energyType ? ENERGY_CONFIGS[energyType as EnergyType] : null;
  const opacity = dimmed ? 0.45 : 1;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size, opacity }}>
      {profile?.photoUrl ? (
        <Image
          src={profile.photoUrl}
          alt={displayName}
          width={size}
          height={size}
          className="rounded-full object-cover border-2 border-[var(--bg-primary)]"
          style={{ width: size, height: size }}
          unoptimized
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center border-2 border-[var(--bg-primary)] bg-gradient-to-br from-[var(--accent)] to-[var(--orange)]"
          style={{ width: size, height: size }}
        >
          <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>{initials}</span>
        </div>
      )}
      {cfg && (
        <div
          className="absolute -bottom-0.5 -right-0.5 bg-[var(--bg-primary)] rounded-full border border-[var(--border-subtle)] flex items-center justify-center"
          style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42), opacity: muted ? 0.5 : 1 }}
        >
          <Image src={cfg.assets.full} alt={cfg.label} width={Math.round(size * 0.3)} height={Math.round(size * 0.3)} style={{ objectFit: "contain" }} unoptimized />
        </div>
      )}
      {muted && (
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{ background: "rgba(7,17,31,0.6)" }}
        >
          <X size={Math.round(size * 0.4)} className="text-[var(--text-muted)]" />
        </div>
      )}
    </div>
  );
}

// ─── Shared focus ring (centerpiece) ─────────────────────────────────────────

const RING_SIZE = 240;

function SharedRing({
  room,
  isHost,
  onDurationChange,
  disabled,
  remainingMs,
  myEnergy,
}: {
  room: FocusRoom;
  isHost: boolean;
  onDurationChange: (m: number) => void;
  disabled: boolean;
  remainingMs: number | null;
  myEnergy: string;
}) {
  const cfg = ENERGY_CONFIGS[myEnergy as EnergyType] || ENERGY_CONFIGS.flame;

  // idle / waiting — host can drag, others see live-updated read-only circle
  if (room.status === "waiting") {
    if (isHost) {
      return (
        <CircularDurationPicker
          value={room.durationMinutes}
          onChange={onDurationChange}
          maxDurationMinutes={FOCUS_DURATION_MAX_MINUTES}
          snapIncrement={FOCUS_DURATION_SNAP_MINUTES}
          minMinutes={FOCUS_DURATION_MIN_MINUTES}
          size={RING_SIZE}
          accentColor={cfg.accent}
          disabled={disabled}
          centerContent={null}
        />
      );
    }

    const frac = focusDurationProgress(room.durationMinutes);
    const radius = (RING_SIZE - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    return (
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ maxWidth: "100%", height: "auto", display: "block" }}>
        <defs>
          <filter id="shared-ring-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={6} opacity={0.5} />
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none"
          stroke={cfg.accent} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${frac * circumference} ${circumference - frac * circumference}`}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{ filter: "url(#shared-ring-glow)", transition: "stroke-dasharray 0.2s ease-out, stroke 0.4s ease" }}
        />
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none"
          stroke={cfg.accent} strokeWidth={4}
          strokeDasharray={`${frac * circumference * 0.02} ${circumference}`}
          strokeLinecap="round" opacity={0.6}
        />
      </svg>
    );
  }

  // active / completed — synchronized countdown ring
  const totalMs = room.durationMinutes * 60 * 1000;
  const remaining = remainingMs ?? totalMs;
  const progress = Math.max(0, Math.min(100, ((totalMs - remaining) / totalMs) * 100));
  const radius = (RING_SIZE - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = (progress / 100) * circumference;

  return (
    <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ maxWidth: "100%", height: "auto", display: "block" }}>
      <defs>
        <filter id="countdown-ring-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={8} opacity={0.35} />
      <circle
        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none"
        stroke={cfg.accent} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference - arc}`}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        style={{ filter: "url(#countdown-ring-glow)", transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
      />
    </svg>
  );
}

export default function FocusRoomsPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [pageState, setPageState] = useState<PageState>("list");
  const [rooms, setRooms] = useState<FocusRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<FocusRoom | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [selectedEnergyType, setSelectedEnergyType] = useState<string>("flame");
  const [selectedDuration, setSelectedDuration] = useState<number>(DEFAULT_DURATION);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<FocusRoom | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Countdown clock
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showCompletion, setShowCompletion] = useState(false);
  const [lastCoins, setLastCoins] = useState(0);
  const [showEnergyPicker, setShowEnergyPicker] = useState(false);
  const [ownedAuras, setOwnedAuras] = useState<string[]>(["flame", "water"]);
  // The user's app-level profile id (Firebase UID hashed the same way the
  // server derives profile ids). Server comparisons such as hostProfileId are
  // done against THIS value, never against the raw Firebase user.uid.
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const ownedAurasSet = useMemo(() => new Set(ownedAuras), [ownedAuras]);
  const selectedEnergyCfg = ENERGY_CONFIGS[selectedEnergyType as EnergyType] || ENERGY_CONFIGS.flame;
  const energyPickerCurrent = useMemo(() => {
    if (pageState === "room" && currentRoom && myProfileId) {
      const mine = currentRoom.participants.find((p) => p.profileId === myProfileId);
      return mine?.selectedEnergyType || selectedEnergyType;
    }
    return selectedEnergyType;
  }, [pageState, currentRoom, myProfileId, selectedEnergyType]);

  const roomSessionRef = useRef<PersistedRoomSession | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError(null);
    try {
      const data = await api.getFocusRooms();
      setRooms(data.rooms);
    } catch {
      setError("Erro ao carregar salas");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // Poll rooms list on mount
  useEffect(() => {
    if (!loading && user) {
      fetchRooms();
      // Lazy stale-room sweep: runs the cleanup job on load so stale rooms get
      // expired even without an external cron.
      api.cleanupFocusRooms().then(() => {}).catch(() => {});
      // If the user arrived via a shared invite link (?join=CODE), pre-fill the
      // join screen so they only need to tap "Entrar".
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get("join");
      if (joinCode) {
        setRoomCode(joinCode.trim().toUpperCase().slice(0, 6));
        setPageState("join");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    api.getStore()
      .then((data) => {
        const owned = data.ownedAuras?.length ? data.ownedAuras : ["flame", "water"];
        setOwnedAuras(owned);
        const def = resolveDefaultEnergy(owned);
        setSelectedEnergyType((prev) => {
          const next = owned.includes(prev) ? prev : def;
          selectEnergyRef.current = next;
          return next;
        });
      })
      .catch(() => { /* default flame+water */ });
  }, [loading, user]);

  // Resolve this user's profile id (the hashed form the server stores in
  // host_profile_id / participant profileId). Every ownership comparison in
  // this page must use this value, not the raw Firebase uid.
  useEffect(() => {
    if (!user) return;
    let active = true;
    api.getProfile()
      .then(({ user: profile }) => { if (active && profile?.id) setMyProfileId(profile.id); })
      .catch(() => { /* room view is gated on myProfileId, so it just keeps loading */ });
    return () => { active = false; };
  }, [user]);

  // ── Room detail polling ────────────────────────────────────────────────────
  const pollRoom = useCallback(async () => {
    if (!currentRoom) return;
    try {
      const data = await api.getFocusRoomById(currentRoom.id);
      const next = data.room;
      setCurrentRoom(next);

      // If the room disappeared (deleted), fall back to list
      if (!next) {
        setCurrentRoom(null);
        setPageState("list");
        fetchRooms();
      }
    } catch {
      // transient polling failure — ignore
    }
  }, [currentRoom, fetchRooms]);

  // Poll while in a waiting, active or paused room view
  useEffect(() => {
    if (pageState !== "room" || !currentRoom) return;
    if (currentRoom.status !== "waiting" && currentRoom.status !== "active" && currentRoom.status !== "paused") return;
    const id = setInterval(() => { pollRoom(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pageState, currentRoom?.id, currentRoom?.status, pollRoom]);

  // 1-second clock for the shared countdown while the session is running.
  // The countdown itself is always wall-clock derived (see sharedRemainingMs),
  // so throttling of this interval in background tabs can't drift it — but we
  // also re-sync the clock the moment the tab regains focus so the display and
  // any completion logic update instantly instead of on the next (possibly
  // suspended) tick.
  useEffect(() => {
    if (pageState !== "room") return;
    if (currentRoom?.status !== "active" && currentRoom?.status !== "paused") return;
    const refresh = () => setNowMs(Date.now());
    const id = setInterval(refresh, 1000);
    const resync = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, [pageState, currentRoom?.status, currentRoom?.id]);

  // ── Initialize this participant's focus session when the room goes active ──
  const sessionCreatingRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (pageState !== "room" || !currentRoom) return;
    if (currentRoom.status !== "active" && currentRoom.status !== "paused") return;

    const persisted = loadRoomSession(currentRoom.id);
    const myParticipant = currentRoom.participants.find((p) => p.profileId === myProfileId);

    // If I already gave up, don't create a new session
    if (myParticipant && myParticipant.sessionStatus === "left") return;

    if (persisted && persisted.sessionId && !persisted.finalized) {
      roomSessionRef.current = persisted;
      return;
    }
    if (roomSessionRef.current?.sessionId && !roomSessionRef.current.finalized) return;
    if (sessionCreatingRef.current) return;

    // Create my session for XP/quest crediting, driven by the room startedAt
    sessionCreatingRef.current = true;
    let cancelled = false;
    api.startFocus(currentRoom.durationMinutes, undefined, selectEnergyRef.current)
      .then(({ session }) => {
        if (cancelled) return;
        const created = new Date().toISOString();
        const state: PersistedRoomSession = { sessionId: session.id, created, finalized: false };
        roomSessionRef.current = state;
        saveRoomSession(currentRoom.id, state);
        setLastCoins(0);
      })
      .catch(() => { /* keep waiting for next poll */ })
      .finally(() => { sessionCreatingRef.current = false; });

    return () => { cancelled = true; };
  }, [user, myProfileId, pageState, currentRoom?.id, currentRoom?.status, currentRoom?.durationMinutes]);

  // ── Shared countdown derivation ────────────────────────────────────────────
  const isRunningRoom = currentRoom?.status === "active" || currentRoom?.status === "paused";
  const startedAtMs = currentRoom?.startedAt ? new Date(currentRoom.startedAt).getTime() : null;
  const totalMs = currentRoom ? currentRoom.durationMinutes * 60 * 1000 : 0;

  // Pause-aware remaining time. The server keeps `elapsedSeconds` (accumulated
  // focused time before the current run segment) plus `lastResumedAt` (when the
  // current active segment began). While paused, only `elapsedSeconds` counts.
  const sharedRemainingMs = useMemo(() => {
    if (!currentRoom || !isRunningRoom) return null;
    const totalSec = currentRoom.durationMinutes * 60;
    let elapsed = currentRoom.elapsedSeconds ?? 0;
    if (currentRoom.status === "active") {
      const resumeAt =
        currentRoom.lastResumedAt
          ? new Date(currentRoom.lastResumedAt).getTime()
          : startedAtMs ?? nowMs;
      elapsed += Math.floor((nowMs - resumeAt) / 1000);
    }
    return Math.max(0, (totalSec - elapsed) * 1000);
  }, [currentRoom, isRunningRoom, startedAtMs, nowMs]);

  // ── Finalize my session on completion ───────────────────────────────────────
  const finalizingRef = useRef(false);
  const finalizeSession = useCallback(async (room: FocusRoom, focusedSeconds: number, addGarden: boolean) => {
    if (finalizingRef.current) return;
    if (!user) return;
    const sess = roomSessionRef.current;
    if (!sess || sess.finalized) return;

    finalizingRef.current = true;
    try {
      const end = await api.endFocus(sess.sessionId, focusedSeconds, true);
      setLastCoins(end.xpAwarded);

      if (addGarden) {
        setShowCompletion(true);
        // Mark room completed (idempotent — first finisher wins)
        await api.completeFocusRoom(room.id).catch(() => {});
      }
    } catch {
      // ignore — next poll may retry
    } finally {
      const s = roomSessionRef.current;
      if (s) {
        const updated = { ...s, finalized: true };
        roomSessionRef.current = updated;
        saveRoomSession(room.id, updated);
      }
      finalizingRef.current = false;
    }
  }, [user]);

  // Watch for countdown reaching zero → finalize (full completion)
  useEffect(() => {
    if (!currentRoom || !isRunningRoom) return;
    if (sharedRemainingMs == null) return;
    if (sharedRemainingMs <= 0) {
      // Award this participant's XP/quest/jardim and mark the room completed.
      finalizeSession(currentRoom, currentRoom.durationMinutes * 60, true);
      // Also transition the local view immediately
      setCurrentRoom((prev) => prev ? { ...prev, status: "completed" } : prev);
    }
  }, [isRunningRoom, sharedRemainingMs, currentRoom, finalizeSession]);

  // When the room becomes COMPLETED server-side while my own session is still
  // unfinalized — another participant's timer hit zero first, or the host
  // stopped the room early — finalize here. This guarantees every participant
  // present for the full session gets paid (equal payout) instead of being
  // skipped because their local countdown never reached zero, and that a
  // stopped-early participant is recorded as a give-up rather than a win.
  useEffect(() => {
    if (!user || !currentRoom) return;
    if (pageState !== "room" || currentRoom.status !== "completed") return;
    const sess = roomSessionRef.current;
    if (!sess || sess.finalized) return;
    const mine = currentRoom.participants.find((p) => p.profileId === myProfileId);
    if (!mine) return;
    if (mine.sessionStatus === "completed") {
      finalizeSession(currentRoom, currentRoom.durationMinutes * 60, true);
    } else if (mine.sessionStatus === "left") {
      finalizeSession(currentRoom, 0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState, currentRoom?.id, currentRoom?.status, user, myProfileId, finalizeSession]);

  // Keep selected energy in a ref so completion closure reads latest
  const selectEnergyRef = useRef<string>(selectedEnergyType);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateRoom = useCallback(async () => {
    setLoadingAction("creating");
    setError(null);
    try {
      selectEnergyRef.current = selectedEnergyType;
      const room = await api.createFocusRoom(selectedDuration, selectedEnergyType);
      setCurrentRoom(room.room);
      setRoomCode(room.room.code);
      setPageState("room");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar sala");
    } finally {
      setLoadingAction(null);
    }
  }, [selectedDuration, selectedEnergyType]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim()) { setError("Digite o código da sala"); return; }
    setLoadingAction("joining");
    setError(null);
    try {
      selectEnergyRef.current = selectedEnergyType;
      const result = await api.joinFocusRoom(roomCode, selectedEnergyType);
      setCurrentRoom(result.room);
      setPageState("room");
      setSuccessMessage("Você entrou na sala!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar na sala");
    } finally {
      setLoadingAction(null);
    }
  }, [roomCode, selectedEnergyType]);

  const handleStartRoom = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction("starting");
    setError(null);
    try {
      const result = await api.startFocusRoom(currentRoom.id);
      setCurrentRoom(result.room);
      setNowMs(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar sala");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom]);

  const handleTogglePause = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction(currentRoom.status === "active" ? "pausing" : "resuming");
    setError(null);
    try {
      const result =
        currentRoom.status === "active"
          ? await api.pauseFocusRoom(currentRoom.id)
          : await api.resumeFocusRoom(currentRoom.id);
      setCurrentRoom(result.room);
      setNowMs(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao pausar/retomar sala");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction("leaving");
    setError(null);
    try {
      if (currentRoom.status === "active" || currentRoom.status === "paused") {
        // Active/paused: mark as gave up instead of removing from history
        await api.giveUpFocusRoom(currentRoom.id);
        await finalizeSession(currentRoom, 0, false);
        setError(null);
      } else {
        await api.leaveFocusRoom(currentRoom.id);
      }
      setPageState("list");
      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sair da sala");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom, fetchRooms, finalizeSession]);

  const handleGiveUp = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction("givingup");
    setError(null);
    try {
      await api.giveUpFocusRoom(currentRoom.id);
      await finalizeSession(currentRoom, 0, false);
      // Mark locally as left in the room view
      setCurrentRoom((prev) => prev ? {
        ...prev,
        participants: prev.participants.map((p) => p.profileId === myProfileId ? { ...p, sessionStatus: "left" } : p),
      } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desistir");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom, myProfileId, finalizeSession]);

  const handleUpdateDuration = useCallback(async (minutes: number) => {
    if (!currentRoom) return;
    try {
      const result = await api.updateRoomDuration(currentRoom.id, minutes);
      setCurrentRoom(result.room);
    } catch {
      // silent — synced via poll
    }
  }, [currentRoom]);

  const handleSelectEnergy = useCallback(async (energyType: string) => {
    if (!currentRoom || !user) return;
    setSelectedEnergyType(energyType);
    selectEnergyRef.current = energyType;
    try {
      const result = await api.selectEnergy(currentRoom.id, energyType);
      setCurrentRoom(result.room);
    } catch {
      // silent
    }
  }, [currentRoom, user]);

  const handleOpenEnergyPicker = useCallback(() => {
    setShowEnergyPicker(true);
  }, []);

  const copyToClipboard = useCallback(() => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentRoom]);

  const shareRoom = useCallback(() => {
    if (!currentRoom) return;
    setShowShare(true);
  }, [currentRoom]);

  const handleDeleteRoom = useCallback(async () => {
    if (!roomToDelete) return;
    setLoadingAction("deleting");
    setError(null);
    try {
      await api.deleteFocusRoom(roomToDelete.id);
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      if (currentRoom?.id === roomToDelete.id) {
        setCurrentRoom(null);
        setPageState("list");
      }
      setSuccessMessage("Sala excluída com sucesso.");
      setShowDeleteConfirm(false);
      setRoomToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir sala");
    } finally {
      setLoadingAction(null);
    }
  }, [roomToDelete, currentRoom]);

  const handleStopRoom = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction("stopping");
    setError(null);
    try {
      const result = await api.stopFocusRoom(currentRoom.id);
      setCurrentRoom(result.room);
      setNowMs(Date.now());
      setShowStopConfirm(false);
      // "Parar" is scoped to the host's own outcome: finalize ONLY the host's
      // session as a give-up (no energy planted, no completion reward). The
      // shared room timer keeps running for everyone else.
      await finalizeSession(currentRoom, 0, false);
      setSuccessMessage("Você parou sua sessão. A sala continua para os outros participantes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao encerrar a sessão");
      setShowStopConfirm(false);
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom, finalizeSession]);

  // ═══════════════════════ VIEWS ═══════════════════════
  const renderListView = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.button
          onClick={() => setPageState("create")}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors"
        >
          <Plus size={16} /> Criar sala
        </motion.button>
        <motion.button
          onClick={() => setPageState("join")}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors"
        >
          <Users size={16} /> Entrar em sala
        </motion.button>
      </div>

      <div className="grid gap-4">
        {rooms.length > 0 ? (
          rooms.map((room) => {
            const isMyRoomHost = room.hostProfileId === myProfileId;
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-faint)] mb-0.5">Sala: {room.code}</p>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {Math.floor(room.durationMinutes / 60)}h{room.durationMinutes % 60 > 0 ? ` ${room.durationMinutes % 60}min` : ""} • {room.energyType || "Foco"}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Status:{" "}
                      {room.status === "waiting" ? "Aguardando" :
                       room.status === "active" ? "Em andamento" :
                       room.status === "paused" ? "Pausada" :
                       room.status === "completed" ? "Concluída" : "Expirada"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                      <Users size={12} /> {room.participants.length}
                    </span>
                    {/* Delete — host (or admin) only, disabled while a session is live */}
                    {isMyRoomHost && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          if (room.status === "active" || room.status === "paused") { setError("Não é possível excluir uma sala em andamento"); return; }
                          setRoomToDelete(room);
                          setShowDeleteConfirm(true);
                        }}
                        disabled={room.status === "active" || room.status === "paused"}
                        className="rounded-lg p-1.5 text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={room.status === "active" || room.status === "paused" ? "Sala em andamento" : "Excluir sala"}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    )}
                    <button
                      onClick={() => {
                        setShowCompletion(false);
                        setLastCoins(0);
                        setCurrentRoom(room);
                        setPageState("room");
                      }}
                      className="text-button text-[10px]"
                    >
                      Ver
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          !loadingRooms && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles size={32} className="text-[var(--text-faint)] mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Você não está em nenhuma sala no momento</p>
              <p className="text-[10px] text-[var(--text-faint)] mt-1">Crie uma sala ou junte-se a uma sala existente</p>
            </div>
          )
        )}
        {loadingRooms && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderCreateView = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setPageState("list")} className="flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={16} /> Voltar
        </button>
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl mb-6">Criar Sala de Foco</h2>
        <div className="space-y-5">
          <div className="flex flex-col items-center">
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">Duração e energia</label>
            <div className="relative mx-auto pt-2" style={{ width: CREATE_RING_SIZE, maxWidth: "100%", aspectRatio: "1 / 1" }}>
              <CircularDurationPicker
                value={selectedDuration}
                onChange={setSelectedDuration}
                maxDurationMinutes={FOCUS_DURATION_MAX_MINUTES}
                snapIncrement={FOCUS_DURATION_SNAP_MINUTES}
                minMinutes={FOCUS_DURATION_MIN_MINUTES}
                size={CREATE_RING_SIZE}
                accentColor={selectedEnergyCfg.accent}
                centerContent={<></>}
              />
              <EnergyRingCenter
                energyType={selectedEnergyType}
                ringSize={CREATE_RING_SIZE}
                stage="full"
                onPick={() => setShowEnergyPicker(true)}
              />
            </div>
            <FocusDurationReadout
              minutes={selectedDuration}
              fontSize={34}
            />
            <span className="mt-2 text-[9px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
              toque no centro para trocar a energia
            </span>
          </div>
          <div className="pt-4">
            <motion.button onClick={handleCreateRoom} disabled={loadingAction === "creating"} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="primary-button w-full">
              {loadingAction === "creating" ? <Loader2 size={16} className="animate-spin" /> : <><Play size={16} /> Criar Sala</>}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderJoinView = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setPageState("list")} className="flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={16} /> Voltar
        </button>
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl mb-6">Entrar em Sala</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">Código da Sala (6 caracteres)</label>
            <div className="flex gap-2">
              <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" className="auth-input flex-1 text-center text-lg tracking-widest" />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">Sua energia (opcional)</label>
            <div
              className="relative rounded-full"
              style={{
                width: JOIN_RING_SIZE,
                height: JOIN_RING_SIZE,
                boxShadow: `0 0 24px ${selectedEnergyCfg.glow}`,
                border: `2px solid ${selectedEnergyCfg.accent}44`,
              }}
            >
              <EnergyRingCenter
                energyType={selectedEnergyType}
                ringSize={JOIN_RING_SIZE}
                stage="full"
                onPick={() => setShowEnergyPicker(true)}
              />
            </div>
            <span className="mt-2 text-[10px] font-medium" style={{ color: selectedEnergyCfg.accent }}>
              {selectedEnergyCfg.label}
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
              toque para trocar
            </span>
          </div>
          <div className="pt-4">
            <motion.button onClick={handleJoinRoom} disabled={loadingAction === "joining" || !roomCode.trim()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="primary-button w-full">
              {loadingAction === "joining" ? <Loader2 size={16} className="animate-spin" /> : <><Users size={16} /> Entrar na Sala</>}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ── Room detail view ───────────────────────────────────────────────────────

  const renderRoomView = () => {
    if (!currentRoom || !user) return null;
    if (!myProfileId) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
        </div>
      );
    }
    const room = currentRoom;
    const isHost = room.hostProfileId === myProfileId;
    const myParticipant = room.participants.find((p) => p.profileId === myProfileId);
    const myEnergy = myParticipant?.selectedEnergyType || selectedEnergyType;
    const myProgress = sharedRemainingMs != null
      ? Math.max(0, Math.min(100, ((totalMs - sharedRemainingMs) / totalMs) * 100))
      : room.status === "completed" ? 100 : 0;
    const running = room.status === "active" || room.status === "paused";
    const paused = room.status === "paused";
    const completed = room.status === "completed";

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header: back + room code + copy/share */}
        <div className="flex items-center gap-2">
          <button onClick={() => { setCurrentRoom(null); setPageState("list"); }} className="flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">
            <ChevronLeft size={16} /> Voltar
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] font-mono text-[var(--text)] tracking-widest">
              {room.code}
            </span>
            <button onClick={copyToClipboard} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <button onClick={shareRoom} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title="Compartilhar">
              <Share2 size={12} /> Compartilhar
            </button>
            {isHost && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (room.status === "active" || room.status === "paused") {
                    setError("Não é possível excluir uma sala em andamento");
                    return;
                  }
                  setRoomToDelete(room);
                  setShowDeleteConfirm(true);
                }}
                disabled={loadingAction === "deleting" || room.status === "active" || room.status === "paused"}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-[10px] text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={room.status === "active" || room.status === "paused" ? "Sala em andamento" : "Excluir sala"}
              >
                {loadingAction === "deleting" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Excluir
              </motion.button>
            )}
          </div>
        </div>

        <div className="panel p-6">
          {/* Status */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl">
              {room.status === "waiting" ? "Sala de Foco" :
               room.status === "active" ? "Foco em Grupo" :
               room.status === "paused" ? "Sessão Pausada" : "Sessão Concluída"}
            </h2>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              {room.status === "waiting" && <><Clock size={12} /> Aguardando início</>}
              {room.status === "active" && <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" /> Em andamento</motion.span>}
              {room.status === "paused" && <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Pausada</motion.span>}
              {room.status === "completed" && <><CheckCircle size={12} className="text-green-400" /> Concluída</>}
            </span>
          </div>

          {/* Participants row + invite slot */}
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3 block">Participantes</span>
            <div className="flex items-center gap-3 flex-wrap">
              {room.participants.map((p) => {
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1">
                    <RoomAvatar profile={p.profile} energyType={p.selectedEnergyType} size={44} muted={p.sessionStatus === "left"} dimmed={p.sessionStatus === "left"} />
                    <span className="text-[9px] text-[var(--text-muted)] max-w-[52px] truncate">{p.profile?.displayName || "Anônimo"}</span>
                    {(p.sessionStatus === "completed") && <span className="text-[8px] text-green-400">✓</span>}
                    {p.sessionStatus === "left" && <span className="text-[8px] text-red-400">desistiu</span>}
                  </div>
                );
              })}
              {/* "+" invite slot — only meaningful while the room is live */}
              {(room.status === "waiting" || room.status === "active" || room.status === "paused") && (
                <button onClick={shareRoom} className="flex flex-col items-center gap-1" title="Convidar">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="w-11 h-11 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                    <UserPlus size={18} />
                  </motion.div>
                  <span className="text-[9px] text-[var(--text-faint)]">Convidar</span>
                </button>
              )}
              {room.participants.length === 0 && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Compartilhe o código com seus amigos para começar.</p>
              )}
            </div>
          </div>

          {/* Shared circle */}
          <div className="flex flex-col items-center">
            <div className="relative" style={{ width: RING_SIZE, maxWidth: "100%" }}>
              <SharedRing
                room={room}
                isHost={isHost}
                onDurationChange={handleUpdateDuration}
                disabled={loadingAction !== null}
                remainingMs={running ? sharedRemainingMs : null}
                myEnergy={myEnergy}
              />

              {/* Center energy image */}
              <EnergyRingCenter
                energyType={myEnergy}
                ringSize={RING_SIZE}
                stage={myParticipant?.sessionStatus === "left" ? "extinguished" : "full"}
                dimmed={running && myParticipant?.sessionStatus === "left"}
                onPick={
                  room.status !== "completed" && myParticipant?.sessionStatus !== "left"
                    ? handleOpenEnergyPicker
                    : undefined
                }
              />
            </div>

            {/* Countdown / duration label */}
            <div className="flex flex-col items-center">
              <FocusDurationReadout
                minutes={room.durationMinutes}
                remainingSeconds={Math.ceil((sharedRemainingMs ?? 0) / 1000)}
                active={running}
                paused={paused}
                pausedLabel="pausada"
              />
              {paused && (
                <span className="mt-1 flex items-center gap-1 text-[10px] text-amber-400">
                  <Pause size={11} /> O anfitrião pausou a sessão
                </span>
              )}
              {room.status === "waiting" && !isHost && (
                <span className="mt-1 text-[10px] text-[var(--text-muted)]">Duração definida pelo anfitrião</span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-faint)]">
              <span className="opacity-60 italic">toque no círculo para trocar sua energia</span>
            </div>
          </div>

          {/* Live progress panel — active/paused session */}
          {(room.status === "active" || room.status === "paused") && room.participants.length > 0 && (
            <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3 block">Progresso da sala</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {room.participants.map((p) => {
                  const isMe = p.profileId === myProfileId;
                  const prog = p.sessionStatus === "left" ? 0 : p.sessionStatus === "completed" ? 100 : myProgress;
                  const size = 48;
                  const r = (size - 8) / 2;
                  const c = 2 * Math.PI * r;
                  const arc = (prog / 100) * c;
                  const color = p.sessionStatus === "left" ? "#ff5a5a" : p.sessionStatus === "completed" ? "#4ade80" : (p.selectedEnergyType ? ENERGY_CONFIGS[p.selectedEnergyType as EnergyType].accent : "var(--accent)");
                  return (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <div className="relative" style={{ width: size, height: size }}>
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={4} opacity={0.4} />
                          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${arc} ${c - arc}`} />
                        </svg>
                        <div className="absolute inset-[6px] rounded-full overflow-hidden">
                          {p.profile?.photoUrl ? (
                            <Image src={p.profile.photoUrl} alt={p.profile.displayName} width={size} height={size} className="w-full h-full object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent)] to-[var(--orange)]">
                              <span className="text-[10px] font-bold text-white">{p.profile?.displayName?.charAt(0) || "?"}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-[var(--text)] truncate">{p.profile?.displayName || "Anônimo"}{isMe ? " (você)" : ""}</p>
                        <p className="text-[8px]" style={{ color }}>
                          {p.sessionStatus === "left" ? "Desistiu" : p.sessionStatus === "completed" ? "Concluído" : `${Math.round(prog)}%`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completion celebration */}
          <AnimatePresence>
            {showCompletion && completed && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 340, damping: 24 }}
                className="mt-6 rounded-2xl border p-4 flex flex-col items-center gap-3 text-center"
                style={{ borderColor: `${ENERGY_CONFIGS[myEnergy as EnergyType].accent}33`, background: `${ENERGY_CONFIGS[myEnergy as EnergyType].accent}0f` }}
              >
                <span className="text-xs uppercase tracking-widest text-[var(--text-faint)]">Sessão concluída!</span>
                <div className="flex items-center gap-2">
                  <CoinIcon size={18} />
                  <span className="font-mono font-bold text-[#ffb86b] text-lg">+{lastCoins} moedas</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">Sua energia foi plantada no seu Meu Jardim e conta para seus objetivos e quests diárias.</p>
                <button onClick={() => setShowCompletion(false)} className="rounded-full px-6 py-2 text-sm font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
                  style={{ background: ENERGY_CONFIGS[myEnergy as EnergyType].accent }}>
                  Concluído
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="mt-8 space-y-3">
            {/* Host while waiting: primary "Iniciar sessão para todos" + a
                secondary Sair so the host can back out before starting. */}
            {room.status === "waiting" && isHost && (
              <div className="space-y-2">
                <motion.button onClick={handleStartRoom} disabled={loadingAction === "starting"} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="primary-button w-full">
                  {loadingAction === "starting" ? <Loader2 size={16} className="animate-spin" /> : <><Play size={16} /> Iniciar sessão para todos</>}
                </motion.button>
                <button onClick={handleLeaveRoom} disabled={loadingAction === "leaving"} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:text-red-400 transition-colors">
                  {loadingAction === "leaving" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Sair da Sala"}
                </button>
              </div>
            )}
            {room.status === "waiting" && !isHost && myParticipant && (
              <div className="flex flex-col items-center gap-2 py-3">
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 size={14} className="animate-spin" /> Aguardando o anfitrião iniciar...
                </motion.div>
              </div>
            )}

            {(room.status === "active" || room.status === "paused" || room.status === "completed") && myParticipant?.sessionStatus !== "left" && (
              <>
                {myParticipant?.sessionStatus === "completed" && (
                  <div className="text-center text-[10px] text-green-400 flex items-center gap-1 justify-center">
                    <CheckCircle size={12} /> Você concluiu esta sessão
                  </div>
                )}
                {(room.status === "active" || room.status === "paused") && myParticipant?.sessionStatus === "focusing" && (
                  <button
                    onClick={handleGiveUp}
                    disabled={loadingAction === "givingup"}
                    className="w-full rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loadingAction === "givingup" ? <Loader2 size={16} className="animate-spin" /> : <>
                      <X size={15} /> Desistir da sessão
                    </>}
                  </button>
                )}
              </>
            )}

            {/* Host-only room controls — Pausar/Retomar (shared countdown) and Parar
                (host's OWN give-up; the room keeps running for everyone else).
                Non-hosts see no room controls here; they get the passive status
                indicator up top and their own synced countdown. */}
            {(room.status === "active" || room.status === "paused") && isHost && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    onClick={handleTogglePause}
                    disabled={loadingAction === "pausing" || loadingAction === "resuming"}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    style={{
                      background: paused ? "linear-gradient(180deg, var(--accent), var(--orange))" : "var(--bg-surface-hover)",
                      color: paused ? "#fff" : "var(--text)",
                      border: paused ? "none" : "1px solid var(--border-subtle)",
                    }}
                  >
                    {(loadingAction === "pausing" || loadingAction === "resuming") ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : paused ? (
                      <><Play size={15} /> Retomar sessão</>
                    ) : (
                      <><Pause size={15} /> Pausar sessão</>
                    )}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setShowStopConfirm(true)}
                    disabled={loadingAction !== null}
                    className="w-full rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-medium flex items-center justify-center gap-2 transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === "stopping" ? <Loader2 size={15} className="animate-spin" /> : <><Square size={14} /> Parar sessão</>}
                  </button>
                </div>
                <p className="text-center text-[10px] text-[var(--text-faint)]">
                  Você é o anfitrião. Pausar/retomar afeta todos na sala; parar encerra apenas a sua própria sessão — a sala continua para os outros participantes.
                </p>
              </div>
            )}

            {room.status === "waiting" && !isHost && (
              <button onClick={handleLeaveRoom} disabled={loadingAction === "leaving"} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:text-red-400 transition-colors">
                {loadingAction === "leaving" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Sair da Sala"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderCurrentView = () => {
    switch (pageState) {
      case "list": return renderListView();
      case "create": return renderCreateView();
      case "join": return renderJoinView();
      case "room": return renderRoomView();
      default: return renderListView();
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <ChevronLeft size={18} /> Voltar
          </Link>
          <div className="ml-auto" />
          <Sparkles size={18} className="text-[var(--accent)]" />
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">Salas de Foco</span>
        </header>

        <AnimatePresence mode="wait">{renderCurrentView()}</AnimatePresence>

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            {error}
          </motion.div>
        )}
        {successMessage && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="mt-4 rounded-lg border border-green-500/20 bg-green-500/8 px-4 py-3 text-sm text-green-400">
            {successMessage}
          </motion.div>
        )}

        {showDeleteConfirm && roomToDelete && (
          <Modal onClose={() => { setShowDeleteConfirm(false); setRoomToDelete(null); }}>
            <div className="glass-card w-full max-w-sm p-6">
              <h3 className="font-display text-lg mb-2">Excluir sala?</h3>
              <p className="text-sm text-[var(--text-muted)] mb-1">
                Tem certeza que deseja excluir a sala <span className="font-mono font-medium text-[var(--text)]">{roomToDelete.code}</span>?
              </p>
              <p className="text-xs text-[var(--text-faint)] mb-6">
                Todos os participantes serão removidos. Esta ação é permanente.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setRoomToDelete(null); }}
                  className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                  Cancelar
                </button>
                <button onClick={handleDeleteRoom} disabled={loadingAction === "deleting"}
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  {loadingAction === "deleting" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Excluir"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showStopConfirm && currentRoom && (
          <Modal onClose={() => setShowStopConfirm(false)}>
            <div className="glass-card w-full max-w-sm p-6">
              <h3 className="font-display text-lg mb-2">Parar sessão?</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Se você parar agora, sua energia será perdida, mas a sessão continua para os outros participantes. Tem certeza?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowStopConfirm(false)}
                  className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                  Cancelar
                </button>
                <button onClick={handleStopRoom} disabled={loadingAction === "stopping"}
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  {loadingAction === "stopping" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Parar"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showShare && currentRoom && (
          <ShareRoomModal
            open={showShare}
            onClose={() => setShowShare(false)}
            roomCode={currentRoom.code}
            roomName="Sala de Foco"
          />
        )}

        {showEnergyPicker && (
          <EnergyPickerModal
            current={energyPickerCurrent}
            ownedAuras={ownedAurasSet}
            onSelect={(type) => {
              if (pageState === "room" && currentRoom) {
                void handleSelectEnergy(type);
              } else {
                setSelectedEnergyType(type);
                selectEnergyRef.current = type;
              }
            }}
            onClose={() => setShowEnergyPicker(false)}
          />
        )}
      </main>
    </AppShell>
  );
}
