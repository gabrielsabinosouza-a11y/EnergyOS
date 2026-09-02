"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, X, Loader2, Trash2, Zap, Repeat } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { api } from "@/lib/api-client";
import { useDailyQuests } from "@/lib/quest-store";
import { CoinIcon } from "@/components/coin-icon";
import { RewardClaimModal } from "@/components/reward-claim-modal";
import {
  DAILY_TASK_LIMIT,
  DAILY_TASK_XP,
  DAILY_TASK_COINS,
  DAILY_TASK_ALL_BONUS_COINS,
} from "@/lib/daily-limits";

interface RecurringDailyTasksProps {
  coins: number;
  onCoinsChange: (coins: number) => void;
  onXpGain?: (xp: number) => void;
}

export function RecurringDailyTasks({ coins, onCoinsChange, onXpGain }: RecurringDailyTasksProps) {
  const { applyMetric, refresh: refreshQuests } = useDailyQuests();
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ id: number; xp: number; coins: number } | null>(null);
  const [rewardModal, setRewardModal] = useState<{ coins: number; xp: number; balance: number } | null>(null);

  const completed = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;

  useEffect(() => {
    let cancelled = false;
    api
      .getDailyTasks()
      .then((data) => {
        if (!cancelled) {
          setTasks(data.tasks);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const data = await api.createDailyTask(newTitle.trim());
      setTasks((prev) => [...prev, data.task]);
      setNewTitle("");
      setShowForm(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(task: UserDailyTask) {
    const completing = !task.isCompleted;
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, isCompleted: completing } : t)));
    if (completing) {
      // Optimistic: advance the related missions in the SAME click — progress
      // bars/counters update instantly and the claim-ready glow appears the
      // moment a mission reaches its target. The server records the same
      // metrics; refresh() below reconciles with the authoritative response.
      applyMetric("TASKS_COMPLETED", { incrementBy: 1 });
      applyMetric("XP_EARNED", { incrementBy: DAILY_TASK_XP });
    }
    try {
      const data = await api.toggleDailyTask(task.id, completing);
      setTasks((ts) => ts.map((t) => (t.id === task.id ? data.task : t)));
      if (data.coinsAwarded > 0) {
        const newCoins = coins + data.coinsAwarded;
        onCoinsChange(newCoins);
        setRewardModal({ coins: data.coinsAwarded, xp: data.xpAwarded, balance: newCoins });
      }
      if (data.xpAwarded > 0) onXpGain?.(data.xpAwarded);
      if (data.xpAwarded > 0 || data.coinsAwarded > 0) {
        setFeedback({ id: task.id, xp: data.xpAwarded, coins: data.coinsAwarded });
        setTimeout(() => setFeedback(null), 1600);
      }
      void refreshQuests();
    } catch {
      setTasks(prev);
      // Request failed: roll the optimistic mission bumps back to server truth.
      void refreshQuests();
    }
  }

  async function handleDelete(id: number) {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.deleteDailyTask(id);
    } catch {
      setTasks(prev);
    }
  }

  return (
    <>
    <div className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">TAREFAS DIÁRIAS</span>
          <span className="hidden rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--accent)] sm:inline">repetem todo dia</span>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="icon-button small" aria-label="Adicionar tarefa">
          {showForm ? <X size={16} /> : <Plus size={18} />}
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
        Cada tarefa criada aqui é sua todo dia, resetando ao amanhecer.
        Complete cada uma para ganhar <b className="text-[var(--green)] font-mono">+{DAILY_TASK_XP} XP</b> e{" "}
        <span className="inline-flex items-baseline gap-1"><CoinIcon size={12} /><b className="text-[var(--green)] font-mono">+{DAILY_TASK_COINS} moedas</b></span>
        {DAILY_TASK_ALL_BONUS_COINS > 0 && <> — e{" "}<span className="inline-flex items-baseline gap-1"><CoinIcon size={12} /><b className="text-[var(--green)] font-mono">+{DAILY_TASK_ALL_BONUS_COINS} moedas</b></span> de bônus ao completar todas</>}.
      </p>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <div className="progress-track flex-1">
            <div className="progress-value" style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{completed}/{total}</span>
          {allDone && <span className="text-[10px] text-[var(--green)] font-medium">✦ tudo feito hoje!</span>}
        </div>
      )}

      {/* New task form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
            <div className="flex gap-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="auth-input flex-1"
                placeholder="Tarefa que você repete todo dia..."
                maxLength={120}
              />
              <button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="icon-button small">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
            </div>
            {total >= DAILY_TASK_LIMIT && (
              <p className="mt-2 text-[11px] text-[var(--text-faint)]">
                Limite alcançado: você pode ter até {DAILY_TASK_LIMIT} tarefas diárias.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      {!loading && tasks.length === 0 && !showForm && (
        <div className="empty-state py-8">
          <strong>Nenhuma tarefa diária ainda</strong>
          <span>Clique + para criar a primeira</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}

      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16, height: 0 }}
            className="group flex items-center gap-2 border-b border-[var(--border-subtle)] py-2.5 last:border-0"
          >
            <button
              onClick={() => handleToggle(task)}
              className={`task-check shrink-0 ${task.isCompleted ? "border-[#71d4ff] bg-[#71d4ff]" : ""}`}
              aria-label={task.isCompleted ? "Desmarcar" : "Concluir"}
            >
              {task.isCompleted && <Check size={11} />}
            </button>
            <span className={`flex-1 text-left text-sm ${task.isCompleted ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
              {task.title}
            </span>
            <AnimatePresence>
                {feedback?.id === task.id && (
                  <motion.span
                    key={`fb-${task.id}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-1 font-mono text-[10px] text-[#ffb86b]"
                  >
                    <Zap size={10} fill="currentColor" />+{feedback.xp} XP
                  </motion.span>
                )}
            </AnimatePresence>
            <div className="flex gap-0.5 opacity-40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button
                onClick={() => handleDelete(task.id)}
                className="icon-button small !h-6 !w-6 text-red-400/60 hover:text-red-400"
                aria-label="Excluir tarefa"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <RewardClaimModal reward={rewardModal} onClose={() => setRewardModal(null)} />
    </div>
    </>
  );
}
