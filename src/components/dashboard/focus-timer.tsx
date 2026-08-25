"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Timer } from "lucide-react";
import type { FocusSession } from "@/types";

const BLOCK_MINUTES = 25;

interface FocusTimerProps {
  todayBlocks: { blocks: number; xpEarned: number };
  history: FocusSession[];
  onStart: (taskId?: number) => Promise<{ session: FocusSession }>;
  onEnd: (sessionId: number) => Promise<{ session: FocusSession; xpAwarded: number }>;
}

export function FocusTimer({ todayBlocks, history, onStart, onEnd }: FocusTimerProps) {
  const [activeSession, setActiveSession] = useState<{ id: number; startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastXp, setLastXp] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateTimer = useCallback(() => {
    if (activeSession) {
      setElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000));
    }
  }, [activeSession]);

  useEffect(() => {
    if (activeSession) {
      timerRef.current = setInterval(updateTimer, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession, updateTimer]);

  async function handleStart() {
    const result = await onStart();
    setActiveSession({ id: result.session.id, startedAt: new Date(result.session.startedAt).getTime() });
    setElapsed(0);
    setLastXp(0);
  }

  async function handlePause() {
    if (!activeSession) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const result = await onEnd(activeSession.id);
    setActiveSession(null);
    setElapsed(0);
    setLastXp(result.xpAwarded);
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const progress = Math.min((elapsed / (BLOCK_MINUTES * 60)) * 100, 100);

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 mb-4">
        <Timer size={16} className="text-[var(--accent)]" />
        <span className="eyebrow muted">FOCO</span>
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative mb-3">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 326.7} 326.7`}
              transform="rotate(-90 60 60)"
              style={{ filter: "drop-shadow(0 0 8px var(--accent))", transition: "stroke-dasharray 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-[var(--text)]">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-[var(--text-faint)]">
              {activeSession ? "em andamento" : "pronto"}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {!activeSession ? (
            <motion.button whileTap={{ scale: 0.92 }} onClick={handleStart} className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity">
              <Play size={14} fill="currentColor" /> Iniciar foco
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale: 0.92 }} onClick={handlePause} className="flex items-center gap-2 rounded-full bg-[#ffb86b] px-5 py-2 text-xs font-bold text-[var(--bg-primary)] hover:opacity-90 transition-opacity">
              <Pause size={14} /> Parar e ganhar XP
            </motion.button>
          )}
        </div>

        {lastXp > 0 && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs text-[#ffb86b] font-mono">
            +{lastXp} XP ganho!
          </motion.p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold text-[var(--accent)]">{todayBlocks.blocks}/{8}</div>
          <div className="text-[10px] text-[var(--text-faint)]">blocos hoje</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 text-center">
          <div className="text-lg font-mono font-bold text-[#ffb86b]">{todayBlocks.xpEarned}</div>
          <div className="text-[10px] text-[var(--text-faint)]">XP hoje</div>
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
                <span className="text-[#ffb86b] font-mono">+{s.xpEarned} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
