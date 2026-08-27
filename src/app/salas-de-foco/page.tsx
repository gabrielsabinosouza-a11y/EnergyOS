"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import type { FocusRoom, RoomParticipant } from "@/lib/db/focus-rooms";

type PageState = "list" | "create" | "waiting" | "active" | "join";

const ENERGY_TYPES = [
  { id: "FOCO", label: "Foco", color: "#71d4ff" },
  { id: "CORPO", label: "Corpo", color: "#6bffb8" },
  { id: "MENTE", label: "Mente", color: "#b69cff" },
  { id: "ORDEM", label: "Ordem", color: "#ffb86b" },
  { id: "ENERGIA", label: "Energia", color: "#ff9f6b" },
];

const DEFAULT_DURATION = 25;

export default function FocusRoomsPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("list");
  const [rooms, setRooms] = useState<FocusRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<FocusRoom | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [selectedEnergyType, setSelectedEnergyType] = useState<string>("FOCO");
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

  const copyToClipboard = useCallback(() => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomCode]);

  const isHost = currentRoom?.hostProfileId === user?.uid;
  const canStart = isHost && currentRoom?.status === "waiting";
  const canEnd = isHost && currentRoom?.status === "active";

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
              Tipo de Energia
            </label>
            <div className="flex gap-2 flex-wrap">
              {ENERGY_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedEnergyType(type.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                    selectedEnergyType === type.id
                      ? `bg-[${type.color}]20 text-[${type.color}]`
                      : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"
                  }`}
                  style={{
                    border: selectedEnergyType === type.id ? `1px solid ${type.color}` : "none",
                  }}
                >
                  {type.label}
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
              {ENERGY_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedEnergyType(type.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                    selectedEnergyType === type.id
                      ? `bg-[${type.color}]20 text-[${type.color}]`
                      : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"
                  }`}
                  style={{
                    border: selectedEnergyType === type.id ? `1px solid ${type.color}` : "none",
                  }}
                >
                  {type.label}
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

  const renderWaitingRoom = () => (
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
            Sala: {currentRoom?.code}
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
            {currentRoom?.durationMinutes} min • {currentRoom?.energyType || "Foco"}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2 block">
              Participantes
            </span>
            <div className="flex flex-wrap gap-2">
              {currentRoom?.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)]"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--orange)] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">
                      {participant.profile?.displayName?.charAt(0) || "?"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text)]">
                    {participant.profile?.displayName || "Anônimo"}
                  </span>
                  {participant.sessionStatus === "focusing" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  )}
                  {participant.sessionStatus === "waiting" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {canStart && (
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
        </div>
      </div>
    </motion.div>
  );

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
            Duração: {currentRoom?.durationMinutes} min • {currentRoom?.energyType || "Foco"}
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
                        {participant.selectedEnergyType && (
                          <p className="text-[8px] text-[var(--text-muted)]">
                            {ENERGY_TYPES.find((t) => t.id === participant.selectedEnergyType)?.label || participant.selectedEnergyType}
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
