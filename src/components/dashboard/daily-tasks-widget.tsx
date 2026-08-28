"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, ListTodo, Zap, RefreshCw } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { api } from "@/lib/api-client";

export function DailyTasksWidget() {
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<{ id: number; xp: number } | null>(null);

  async function loadData() {
    try {
      const data = await api.getDailyTasks();
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as tarefas diárias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.getDailyTasks();
        if (!active) return;
        setTasks(data.tasks);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Não foi possível carregar as tarefas diárias.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function toggle(task: UserDailyTask) {
    if (togglingId !== null) return;
    setTogglingId(task.id);
    try {
      const result = await api.toggleDailyTask(task.id, !task.isCompleted);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? result.task : t)));
      if (result.xpAwarded > 0) {
        setJustCompleted({ id: task.id, xp: result.xpAwarded });
        setTimeout(() => setJustCompleted(null), 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a tarefa.");
    } finally {
      setTogglingId(null);
    }
  }

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">TAREFAS DIÁRIAS</span>
        </div>
        <button onClick={refresh} disabled={refreshing} className="icon-button small" title="Gerar novamente">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

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

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : tasks.length === 0 && !error ? (
        <div className="empty-state py-8">
          <strong>Nenhuma tarefa hoje</strong>
          <span>Clique no botão acima para gerar</span>
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
                {justCompleted?.id === task.id && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-0.5 text-[10px] text-[#ffb86b] font-mono"
                  >
                    <Zap size={10} fill="currentColor" />+{justCompleted.xp}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
