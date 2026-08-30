"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, ListTodo, Zap, Plus, Trash2 } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { api } from "@/lib/api-client";
import { CoinIcon } from "@/components/coin-icon";
import { RewardToast } from "@/components/reward-toast";
import {
  DAILY_TASK_LIMIT,
  DAILY_TASK_XP,
  DAILY_TASK_COINS,
  DAILY_TASK_ALL_BONUS_COINS,
} from "@/lib/daily-limits";

export function DailyTasksWidget() {
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rewardFlash, setRewardFlash] = useState<{ id: number; xp: number; coins: number } | null>(null);
  const [rewardToast, setRewardToast] = useState<{ amount: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getDailyTasks();
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as tarefas diárias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function addTask() {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    setError(null);
    try {
      const result = await api.createDailyTask(title);
      setTasks((prev) => [...prev, result.task]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível adicionar a tarefa.");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(task: UserDailyTask) {
    if (togglingId !== null) return;
    setTogglingId(task.id);
    setError(null);
    try {
      const result = await api.toggleDailyTask(task.id, !task.isCompleted);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? result.task : t)));
      if (result.xpAwarded > 0 || result.coinsAwarded > 0) {
        setRewardFlash({ id: task.id, xp: result.xpAwarded, coins: result.coinsAwarded });
        setTimeout(() => setRewardFlash(null), 1800);
      }
      if (result.coinsAwarded > 0) {
        setRewardToast({ amount: result.coinsAwarded });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a tarefa.");
    } finally {
      setTogglingId(null);
    }
  }

  async function removeTask(taskId: number) {
    if (deletingId !== null) return;
    setDeletingId(taskId);
    setError(null);
    try {
      await api.deleteDailyTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível remover a tarefa.");
    } finally {
      setDeletingId(null);
    }
  }

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const canAddMore = tasks.length < DAILY_TASK_LIMIT;

  return (
    <>
    <div className="panel p-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">TAREFAS DIÁRIAS</span>
        </div>
        <span className="text-[10px] text-[var(--text-faint)]">renova à meia-noite</span>
      </div>

      <p className="mb-4 text-[11px] text-[var(--text-muted)]">
        Escreva até {DAILY_TASK_LIMIT} tarefas para hoje · +{DAILY_TASK_XP} XP e <span className="inline-flex items-baseline gap-0.5 align-baseline"><CoinIcon size={10} />+{DAILY_TASK_COINS} moedas</span> cada · bônus +{DAILY_TASK_ALL_BONUS_COINS} ao completar todas
      </p>

      {total > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <div className="progress-track flex-1">
            <div className="progress-value" style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{completedCount}/{total}</span>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      {canAddMore && (
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTask();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex: Estudar 30 min, ir à academia..."
            maxLength={120}
            className="auth-input flex-1 text-sm"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !draft.trim()}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--bg-surface-active)] disabled:opacity-40"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Adicionar
          </button>
        </form>
      )}

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state py-8">
          <strong>Nenhuma tarefa ainda</strong>
          <span>Escreva suas tarefas de hoje acima</span>
        </div>
      ) : (
        <AnimatePresence>
          {tasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              className="group flex items-center gap-2 py-2.5 border-b border-[var(--border-subtle)] last:border-0"
            >
              <button
                onClick={() => toggle(task)}
                disabled={togglingId !== null}
                className={`task-check shrink-0 ${task.isCompleted ? "border-[#71d4ff] bg-[#71d4ff]" : ""}`}
              >
                {task.isCompleted && <Check size={11} />}
              </button>
              <span className={`flex-1 text-left text-sm ${task.isCompleted ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                <span className="mr-1.5 font-mono text-[10px] text-[var(--text-faint)]">{index + 1}.</span>
                {task.title}
              </span>
              <AnimatePresence>
                {rewardFlash?.id === task.id && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-1.5 text-[10px] font-mono"
                  >
                    {rewardFlash.xp > 0 && (
                      <span className="flex items-center gap-0.5 text-[#ffb86b]">
                        <Zap size={10} fill="currentColor" />+{rewardFlash.xp}
                      </span>
                    )}
{rewardFlash.coins > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <CoinIcon size={11} />+{rewardFlash.coins}
                      </span>
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
              {!task.isCompleted && (
                <button
                  onClick={() => removeTask(task.id)}
                  disabled={deletingId !== null}
                  className="rounded-lg p-1 text-[var(--text-faint)] opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                  title="Remover"
                >
                  {deletingId === task.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>

    <RewardToast toast={rewardToast} onDone={() => setRewardToast(null)} />
    </>
  );
}
