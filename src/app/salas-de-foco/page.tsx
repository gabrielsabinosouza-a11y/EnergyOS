"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthRedirect } from "@/lib/auth-context";
import {
  Plus,
  X,
  Check,
  Clock,
  Users,
  Play,
  Square,
  Copy,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import type { FocusRoom, RoomParticipant } from "@/lib/db/focus-rooms";
import { ENERGY_CONFIGS, ENERGY_TYPES, type EnergyType } from "@/lib/energy-assets";
import { CircularDurationPicker } from "@/components/dashboard/circular-duration-picker";

type PageState = "list" | "create" | "waiting" | "active" | "join";

const DEFAULT_DURATION = 25;

// Energy picker modal for room participants
function EnergyPickerModal({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (t: string) => void;
  onClose: () => void;
}) {
  const availableTypes = ENERGY_TYPES.filter((t) => !ENERGY_CONFIGS[t].locked);

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
          {availableTypes.map((type) => {
            const cfg = ENERGY_CONFIGS[type];
            const isSelected = type === current;
            return (
              <button
                key={type}
                onClick={() => { onSelect(type); onClose(); }}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition"
                style={{
                  background: isSelected ? cfg.glow : "transparent",
                  border: isSelected ? `1px solid ${cfg.accent}44` : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div className="relative w-12 h-12">
                  <Image src={cfg.assets.spark} alt={cfg.label} fill style={{ objectFit: "contain" }} unoptimized />
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

// Participant circle component - shows each user's focus circle in waiting room
function ParticipantCircle({
  participant,
  room,
  currentUserId,
  isHost,
  onDurationChange,
  onEnergySelect,
  disabled,
}: {
  participant: RoomParticipant & { profile: { id: string; displayName: string; photoUrl?: string } };
  room: FocusRoom;
  currentUserId: string;
  isHost: boolean;
  onDurationChange?: (minutes: number) => void;
  onEnergySelect: (energyType: string) => void;
  disabled: boolean;
}) {
  const isCurrentUser = participant.profile.id === currentUserId;
  const canEditDuration = isCurrentUser && isHost;
  const canEditEnergy = isCurrentUser;
  
  const [showPicker, setShowPicker] = useState(false);
  
  // Get energy config for the participant's selected energy
  const energyConfig = participant.selectedEnergyType 
    ? ENERGY_CONFIGS[participant.selectedEnergyType as EnergyType]
    : ENERGY_CONFIGS.flame;

  const displayName = participant.profile.displayName || "Anônimo";
  const initials = displayName.charAt(0).toUpperCase();
  const photoUrl = participant.profile.photoUrl;

  const RING_SIZE = 140;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        {/* Duration picker for host */}
        {canEditDuration ? (
          <CircularDurationPicker
            value={room.durationMinutes}
            onChange={onDurationChange || (() => {})}
            maxDurationMinutes={120}
            snapIncrement={5}
            minMinutes={10}
            size={RING_SIZE}
            accentColor={energyConfig.accent}
            disabled={disabled}
            centerContent={null}
          />
        ) : (
          <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
            {/* Read-only circle for non-host participants */}
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              style={{ maxWidth: "100%", height: "auto", display: "block" }}
            >
              <defs>
                <filter id="room-countdown-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={(RING_SIZE - 16) / 2}
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth={6}
                opacity={0.5}
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={(RING_SIZE - 16) / 2}
                fill="none"
                stroke={energyConfig.accent}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${(room.durationMinutes / 120) * 2 * Math.PI * ((RING_SIZE - 16) / 2)} ${2 * Math.PI * ((RING_SIZE - 16) / 2) - (room.durationMinutes / 120) * 2 * Math.PI * ((RING_SIZE - 16) / 2)}`}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                style={{ filter: "url(#room-countdown-glow)" }}
              />
            </svg>
            
            {/* Center - avatar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={displayName}
                  width={60}
                  height={60}
                  className="rounded-full object-cover border-2 border-[var(--bg-primary)]"
                  unoptimized
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--orange)] flex items-center justify-center border-2 border-[var(--bg-primary)]">
                  <span className="text-[10px] font-bold text-white">{initials}</span>
                </div>
              )}
              
              {/* Energy icon indicator */}
              {participant.selectedEnergyType && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-[var(--bg-primary)] rounded-full border-2 border-[var(--border-subtle)] flex items-center justify-center p-0.5">
                  <Image
                    src={energyConfig.assets.spark}
                    alt={energyConfig.label}
                    width={20}
                    height={20}
                    style={{ objectFit: "contain" }}
                    unoptimized
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Duration label for all */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <span className="text-xs font-mono text-[var(--text)] bg-[var(--bg-primary)]/80 px-2 py-0.5 rounded-full backdrop-blur-sm">
            {room.durationMinutes}min
          </span>
        </div>

        {/* Energy picker button for current user */}
        {canEditEnergy && !canEditDuration && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker(true);
            }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10 }}
          >
            <div className="w-full h-full rounded-full" style={{ cursor: "pointer" }} />
          </button>
        )}

        {/* Host label */}
        {isCurrentUser && isHost && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
            Anfitrião
          </span>
        )}
      </div>

      {/* Participant name */}
      <div className="text-center">
        <p className="text-[10px] font-medium text-[var(--text)] truncate max-w-full">
          {displayName}
          {isCurrentUser && <span className="text-[var(--text-faint)]"> (você)</span>}
        </p>
        
        {/* Read-only indicator for non-host participants */}
        {isCurrentUser && !isHost && (
          <p className="text-[8px] text-[var(--text-muted)] mt-0.5">
            Duração pelo anfitrião
          </p>
        )}

        {/* Host can edit duration */}
        {canEditDuration && (
          <p className="text-[8px] text-[var(--text-muted)] mt-0.5">
            Ajuste o tempo
          </p>
        )}

        {/* Non-host current user can change energy */}
        {canEditEnergy && !canEditDuration && (
          <p className="text-[8px] text-[var(--text-muted)] mt-0.5 cursor-pointer hover:text-[var(--text)]" 
             onClick={() => setShowPicker(true)}>
            Toque para trocar energia
          </p>
        )}
      </div>

      {/* Energy picker modal */}
      <AnimatePresence>
        {showPicker && (
          <EnergyPickerModal
            current={participant.selectedEnergyType || "flame"}
            onSelect={onEnergySelect}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FocusRoomsPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const router = useRouter();
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

  useEffect(() => {
    if (!loading && user) {
      fetchRooms();
    }
  }, [loading, user]);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError(null);
    try {
      const data = await api.getFocusRooms();
      setRooms(data.rooms);
    } catch (err) {
      setError("Erro ao carregar salas");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const handleCreateRoom = useCallback(async () => {
    setLoadingAction("creating");
    setError(null);
    try {
      const room = await api.createFocusRoom(selectedDuration, selectedEnergyType);
      setCurrentRoom(room.room);
      setRoomCode(room.room.code);
      setPageState("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar sala");
    } finally {
      setLoadingAction(null);
    }
  }, [selectedDuration, selectedEnergyType]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim()) {
      setError("Digite o código da sala");
      return;
    }
    setLoadingAction("joining");
    setError(null);
    try {
      const result = await api.joinFocusRoom(roomCode, selectedEnergyType);
      setCurrentRoom(result.room);
      setPageState("waiting");
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
      setPageState("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar sala");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom]);

  const handleEndRoom = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction("ending");
    setError(null);
    try {
      const result = await api.endFocusRoom(currentRoom.id);
      setCurrentRoom(result.room);
      setPageState("list");
      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar sala");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom, fetchRooms]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentRoom) return;
    setLoadingAction("leaving");
    setError(null);
    try {
      await api.leaveFocusRoom(currentRoom.id);
      setPageState("list");
      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sair da sala");
    } finally {
      setLoadingAction(null);
    }
  }, [currentRoom, fetchRooms]);

  const handleUpdateDuration = useCallback(async (minutes: number) => {
    if (!currentRoom) return;
    try {
      const result = await api.updateRoomDuration(currentRoom.id, minutes);
      setCurrentRoom(result.room);
    } catch (err) {
      console.error("Failed to update duration:", err);
    }
  }, [currentRoom]);

  const handleSelectEnergy = useCallback(async (energyType: string) => {
    if (!currentRoom || !user) return;
    try {
      const result = await api.selectEnergy(currentRoom.id, energyType);
      setCurrentRoom(result.room);
    } catch (err) {
      console.error("Failed to select energy:", err);
    }
  }, [currentRoom, user]);

  const copyToClipboard = useCallback(() => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomCode]);

  const isHost = currentRoom?.hostProfileId === user?.uid;
  const canStart = isHost && currentRoom?.status === "waiting";
  const canEnd = isHost && currentRoom?.status === "active";

  // Get current user's participant data
  const currentUserParticipant = useMemo(() => {
    if (!currentRoom || !user) return null;
    return currentRoom.participants.find(p => p.profileId === user.uid);
  }, [currentRoom, user]);

  const renderListView = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <motion.button
          onClick={() => setPageState("create")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors"
        >
          <Plus size={16} />
          Criar sala
        </motion.button>
        <motion.button
          onClick={() => setPageState("join")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors"
        >
          <Users size={16} />
          Entrar em sala
        </motion.button>
      </div>

      <div className="grid gap-4">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-faint)] mb-0.5">
                    Sala: {room.code}
                  </p>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {room.durationMinutes} min • {room.energyType || "Foco"}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Status: {room.status === "waiting" ? "Aguardando" : room.status === "active" ? "Ativa" : "Concluída"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                    <Users size={12} />
                    {room.participants.length}
                  </span>
                  <button
                    onClick={() => {
                      setCurrentRoom(room);
                      setPageState(room.status === "waiting" ? "waiting" : "active");
                    }}
                    className="text-button text-[10px]"
                  >
                    Ver
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          !loadingRooms && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles size={32} className="text-[var(--text-faint)] mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                Você não está em nenhuma sala no momento
              </p>
              <p className="text-[10px] text-[var(--text-faint)] mt-1">
                Crie uma sala ou junte-se a uma sala existente
              </p>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPageState("list")}
          className="flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl mb-6">Criar Sala de Foco</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">
              Duração
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedDuration(Math.max(5, selectedDuration - 5))}
                className="w-8 h-8 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                -5
              </button>
              <span className="font-mono text-lg text-[var(--text)] min-w-[40px] text-center">
                {selectedDuration}
              </span>
              <button
                onClick={() => setSelectedDuration(Math.min(120, selectedDuration + 5))}
                className="w-8 h-8 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                +5
              </button>
              <span className="text-[10px] text-[var(--text-faint)]">minutos</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">
              Tipo de Energia Inicial
            </label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(ENERGY_CONFIGS)
                .filter(([_, cfg]) => !cfg.locked)
                .map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedEnergyType(type)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      selectedEnergyType === type
                        ? `bg-[${cfg.accent}]20 text-[${cfg.accent}]`
                        : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"
                    }`}
                    style={{
                      border: selectedEnergyType === type ? `1px solid ${cfg.accent}` : "none",
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="pt-4">
            <motion.button
              onClick={handleCreateRoom}
              disabled={loadingAction === "creating"}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="primary-button w-full"
            >
              {loadingAction === "creating" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Play size={16} /> Criar Sala
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderJoinView = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPageState("list")}
          className="flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl mb-6">Entrar em Sala</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">
              Código da Sala (6 caracteres)
            </label>
            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="auth-input flex-1 text-center text-lg tracking-widest"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">
              Tipo de Energia (opcional)
            </label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(ENERGY_CONFIGS)
                .filter(([_, cfg]) => !cfg.locked)
                .map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedEnergyType(type)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      selectedEnergyType === type
                        ? `bg-[${cfg.accent}]20 text-[${cfg.accent}]`
                        : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"
                    }`}
                    style={{
                      border: selectedEnergyType === type ? `1px solid ${cfg.accent}` : "none",
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="pt-4">
            <motion.button
              onClick={handleJoinRoom}
              disabled={loadingAction === "joining" || !roomCode.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="primary-button w-full"
            >
              {loadingAction === "joining" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Users size={16} /> Entrar na Sala
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderWaitingRoom = () => {
    if (!currentRoom || !user) return null;

    const isHost = currentRoom.hostProfileId === user.uid;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCurrentRoom(null);
              setPageState("list");
            }}
            className="flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--text-faint)]">
              Sala: {currentRoom.code}
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado!" : "Copiar código"}
            </button>
          </div>
        </div>

        <div className="panel p-6">
          <div className="mb-6">
            <h2 className="font-display text-xl">Sala de Espera</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {currentRoom.durationMinutes} min • Aguardando início
            </p>
          </div>

          <div className="space-y-6">
            {/* Individual focus circles for each participant */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3 block">
                Participantes e configurações
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {currentRoom.participants.map((participant) => {
                  const participantProfile = participant.profile || { id: participant.profileId, displayName: "Anônimo" };
                  
                  return (
                    <ParticipantCircle
                      key={participant.id}
                      participant={{ ...participant, profile: participantProfile }}
                      room={currentRoom}
                      currentUserId={user.uid}
                      isHost={isHost}
                      onDurationChange={handleUpdateDuration}
                      onEnergySelect={handleSelectEnergy}
                      disabled={loadingAction !== null}
                    />
                  );
                })}
              </div>
            </div>

            {/* Host controls */}
            {canStart && currentRoom.participants.length > 0 && (
              <motion.button
                onClick={handleStartRoom}
                disabled={loadingAction === "starting" || !currentRoom}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="primary-button w-full"
              >
                {loadingAction === "starting" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Play size={16} /> Iniciar Sessão para Todos
                  </>
                )}
              </motion.button>
            )}

            {currentRoom.participants.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-[var(--text-muted)]">
                  Aguardando participantes...
                </p>
                <p className="text-[10px] text-[var(--text-faint)] mt-1">
                  Compartilhe o código {currentRoom.code} com seus amigos
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Leave button for non-host participants */}
        {!isHost && (
          <motion.button
            onClick={handleLeaveRoom}
            disabled={loadingAction === "leaving"}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-red-500/15"
          >
            {loadingAction === "leaving" ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              "Sair da Sala"
            )}
          </motion.button>
        )}
      </motion.div>
    );
  };

  const renderActiveRoom = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (canEnd) {
              handleEndRoom();
            } else {
              handleLeaveRoom();
            }
          }}
          className="flex items-center gap-1 text-[var(--text-faint)] hover:text-red-400 transition-colors"
        >
          <X size={16} />
          {canEnd ? "Finalizar Sessão" : "Sair da Sala"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-faint)]">
            Sala: {currentRoom?.code}
          </span>
        </div>
      </div>

      <div className="panel p-6">
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl">Foco em Grupo</h2>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Duração: {currentRoom?.durationMinutes} min
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2 block">
              Participantes
            </span>
            <div className="grid gap-3">
              {currentRoom?.participants.map((participant) => {
                const isCurrentUser = participant.profileId === user?.uid;
                const energyConfig = participant.selectedEnergyType 
                  ? ENERGY_CONFIGS[participant.selectedEnergyType as EnergyType]
                  : null;
                
                return (
                  <motion.div
                    key={participant.id}
                    layout
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      isCurrentUser
                        ? "bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                        : "bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--orange)] flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                          {participant.profile?.displayName?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-[var(--text)]">
                          {participant.profile?.displayName || "Anônimo"}
                          {isCurrentUser && <span className="text-[var(--text-faint)]"> (você)</span>}
                        </p>
                        {participant.selectedEnergyType && energyConfig && (
                          <p className="text-[8px] text-[var(--text-muted)] flex items-center gap-1">
                            <Image
                              src={energyConfig.assets.spark}
                              alt={energyConfig.label}
                              width={12}
                              height={12}
                              style={{ objectFit: "contain", display: "inline-block" }}
                              unoptimized
                            />
                            {energyConfig.label}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {participant.sessionStatus === "focusing" && (
                        <motion.div
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-green-400"
                        />
                      )}
                      {participant.sessionStatus === "completed" && (
                        <CheckCircle size={14} className="text-green-400" />
                      )}
                      {participant.sessionStatus === "left" && (
                        <XCircle size={14} className="text-red-400" />
                      )}
                      {participant.sessionStatus === "waiting" && (
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {canEnd && (
            <motion.button
              onClick={handleEndRoom}
              disabled={loadingAction === "ending"}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-medium transition-colors hover:bg-red-500/20"
            >
              {loadingAction === "ending" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Square size={16} className="fill-current" /> Finalizar Sessão para Todos
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderCurrentView = () => {
    switch (pageState) {
      case "list":
        return renderListView();
      case "create":
        return renderCreateView();
      case "join":
        return renderJoinView();
      case "waiting":
        return renderWaitingRoom();
      case "active":
        return renderActiveRoom();
      default:
        return renderListView();
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

        <AnimatePresence mode="wait">
          {renderCurrentView()}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 rounded-lg border border-green-500/20 bg-green-500/8 px-4 py-3 text-sm text-green-400"
          >
            {successMessage}
          </motion.div>
        )}
      </main>
    </AppShell>
  );
}
