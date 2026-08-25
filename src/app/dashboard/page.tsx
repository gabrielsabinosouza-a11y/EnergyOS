"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, Flame, Loader2, Moon, Pencil, Plus, Sparkles, Target, Timer, Trash2, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import Link from "next/link";
import type { Task, TaskCategory, Metric } from "@/types";
import type { DashboardSnapshotResponse } from "@/lib/db/dashboard";
import { api } from "@/lib/api-client";

const CATEGORIES: TaskCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

const METRIC_ICONS: Record<string, React.ElementType> = { sleep: Moon, study: Timer, training: Target };
const METRIC_COLORS: Record<string, string> = { sleep: "#71d4ff", study: "#b69cff", training: "#ffb86b" };

function formatMetric(m: Metric) {
  if (m.unit === "h") return m.value > 0 ? `${m.value.toFixed(1)}h` : "—";
  if (m.unit === "min") return m.value > 0 ? `${Math.round(m.value)}min` : "—";
  return m.value > 0 ? String(m.value) : "—";
}

function todayLabel() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${name.split(" ")[0]}`;
}

export default function DashboardPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [snapshot, setSnapshot] = useState<DashboardSnapshotResponse | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState("");
  const [sleepAnswer, setSleepAnswer] = useState("7 a 8 horas");
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinSaved, setCheckinSaved] = useState(false);

  // new task form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("FOCO");
  const [saving, setSaving] = useState(false);

  // edit task
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<TaskCategory>("FOCO");
  const editRef = useRef<HTMLInputElement>(null);

  async function fetchDashboard() {
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as DashboardSnapshotResponse;
      setSnapshot(data);
      setTasks(data.tasks);
      setError("");
    } catch {
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoadingPage(false);
    }
  }

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    user.getIdToken()
      .then((token) => fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } }))
      .then((res) => { if (!res.ok) throw new Error(); return res.json() as Promise<DashboardSnapshotResponse>; })
      .then((data) => { if (cancelled) return; setSnapshot(data); setTasks(data.tasks); setError(""); setLoadingPage(false); })
      .catch(() => { if (cancelled) return; setError("Não foi possível carregar os dados."); setLoadingPage(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid]);

  async function authFetch(url: string, init: RequestInit = {}) {
    const token = await user?.getIdToken();
    return fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  }

  async function saveCheckin() {
    const sleepHours = sleepAnswer === "Menos de 6 horas" ? 5 : sleepAnswer === "6 a 7 horas" ? 6.5 : sleepAnswer === "7 a 8 horas" ? 7.5 : 8.5;
    setCheckinSaving(true);
    setCheckinSaved(false);
    try {
      console.log('[dashboard] Attempting to save checkin with sleepHours:', sleepHours);
      await api.saveCheckin({ sleepHours });
      console.log('[dashboard] Checkin saved successfully');
      setCheckinSaved(true);
      await fetchDashboard();
    } catch (error) {
      console.error('[dashboard] Error saving checkin:', error);
      setError(error instanceof Error ? error.message : "Não foi possível salvar o check-in.");
    } finally {
      setCheckinSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    const completed = !task.completedAt;
    const previousTasks = tasks;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completedAt: completed ? new Date().toISOString() : undefined } : t));
    try {
      const response = await authFetch(`/api/tasks/${task.id}/complete`, { method: "POST", body: JSON.stringify({ completed }) });
      if (!response.ok) throw new Error("Não foi possível atualizar a tarefa.");
      const data = await response.json() as { task: Task };
      setTasks((prev) => prev.map((item) => item.id === task.id ? data.task : item));
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa.");
    }
  }

  async function deleteTask(id: number) {
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const response = await authFetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Não foi possível excluir a tarefa.");
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Não foi possível excluir a tarefa.");
    }
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/tasks", { method: "POST", body: JSON.stringify({ title: newTitle.trim(), category: newCategory }) });
      if (!res.ok) throw new Error("Não foi possível criar a tarefa.");
      const data = (await res.json()) as { task: Task };
      setTasks((prev) => [...prev, data.task]);
      setNewTitle("");
      setShowForm(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditCategory(task.category);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  async function saveEdit(id: number) {
    if (!editTitle.trim()) { setEditingId(null); return; }
    const previousTasks = tasks;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, title: editTitle.trim(), category: editCategory } : t));
    setEditingId(null);
    try {
      const response = await authFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ title: editTitle.trim(), category: editCategory }) });
      if (!response.ok) throw new Error("Não foi possível editar a tarefa.");
      const data = await response.json() as { task: Task };
      setTasks((prev) => prev.map((item) => item.id === id ? data.task : item));
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Não foi possível editar a tarefa.");
    }
  }

  const completed = tasks.filter((t) => Boolean(t.completedAt)).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const streakQualified = percentage >= 50;
  const streak = snapshot?.streak.currentStreak ?? 0;
  const displayName = user?.displayName ?? snapshot?.user.displayName ?? "você";

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
      </div>
    );
  }

  if (loadingPage) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[.2em] text-[#71d4ff]">{todayLabel()}</p>
            <h1 className="font-display text-3xl tracking-[-.04em] sm:text-4xl">
              {greeting(displayName)}<span className="text-[#ffb86b]">.</span>
            </h1>
          </div>
          {streak > 0 && (
            <div className="streak"><Flame size={18} fill="currentColor" /> <span>{streak}</span><small>dias</small></div>
          )}
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <section className="question-panel mb-10 p-6 sm:p-8">
          <span className="eyebrow"><Sparkles size={13} /> CHECK-IN DIÁRIO</span>
          <h2 className="mt-5 font-display text-2xl">Como você dormiu na noite passada?</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">{["Menos de 6 horas", "6 a 7 horas", "7 a 8 horas", "Mais de 8 horas"].map((answer) => <button key={answer} onClick={() => setSleepAnswer(answer)} className={`answer-option ${sleepAnswer === answer ? "selected" : ""}`}><span className="answer-dot">{sleepAnswer === answer && <span />}</span>{answer}</button>)}</div>
          <button onClick={saveCheckin} disabled={checkinSaving} className="primary-button mt-6">{checkinSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {checkinSaved ? "Check-in salvo" : "Salvar check-in"}</button>
        </section>

        {/* Métricas */}
        {snapshot?.metrics && snapshot.metrics.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <span className="eyebrow muted">ÚLTIMOS 7 DIAS</span>
                <h2 className="mt-2 font-display text-2xl">Médias da semana</h2>
              </div>
              <Link href="/relatorio" className="text-button">Ver relatório <ArrowUpRight size={15} /></Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {snapshot.metrics.map((m) => {
                const Icon = METRIC_ICONS[m.kind] ?? Sparkles;
                const color = METRIC_COLORS[m.kind] ?? "#71d4ff";
                return (
                  <motion.div key={m.kind} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="metric-card">
                    <div className="mb-7 flex justify-between">
                      <div className="metric-icon" style={{ color }}><Icon size={17} /></div>
                      {m.trend !== undefined && <span className="trend">{m.trend > 0 ? "+" : ""}{m.trend}%</span>}
                    </div>
                    <span className="metric-caption">{m.label}</span>
                    <div className="mt-1 font-display text-2xl">{formatMetric(m)}</div>
                    <div className="sparkline" style={{ background: color }} />
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tarefas */}
        <section className="mt-2 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <div className="panel p-6 sm:p-8">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <span className="eyebrow muted">HOJE</span>
                <h2 className="mt-2 font-display text-2xl">Tarefas essenciais</h2>
              </div>
              <button onClick={() => setShowForm((v) => !v)} className="icon-button small" aria-label="Adicionar tarefa">
                {showForm ? <X size={16} /> : <Plus size={18} />}
              </button>
            </div>

            {/* Formulário nova tarefa */}
            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                  <div className="flex gap-2 mb-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createTask()}
                      className="auth-input flex-1"
                      placeholder="Título da tarefa..."
                    />
                    <button onClick={createTask} disabled={saving || !newTitle.trim()} className="icon-button small">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`answer-option !w-auto !px-3 !py-1 !text-[10px] ${newCategory === cat ? "selected" : ""}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Barra de progresso */}
            {total > 0 && (
              <div className="mb-6 flex items-center gap-4">
                <div className="progress-track">
                  <div className="progress-value" style={{ width: `${percentage}%` }} />
                </div>
                <span className="text-sm text-white/70">{completed}/{total}</span>
                <span className="text-xs text-white/35">{streakQualified ? "streak garantido ✦" : "ainda dá tempo"}</span>
              </div>
            )}

            {/* Lista de tarefas */}
            {tasks.length === 0 && !showForm && (
              <div className="empty-state py-10">
                <strong>Nenhuma tarefa hoje</strong>
                <span>Clique em + para adicionar sua primeira tarefa</span>
              </div>
            )}

            <AnimatePresence>
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, height: 0 }}
                  className="task-row group"
                >
                  {editingId === task.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        ref={editRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(task.id); if (e.key === "Escape") setEditingId(null); }}
                        className="auth-input !py-1 !text-sm flex-1"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {CATEGORIES.map((cat) => (
                          <button key={cat} onClick={() => setEditCategory(cat)} className={`answer-option !w-auto !px-2 !py-0.5 !text-[9px] ${editCategory === cat ? "selected" : ""}`}>{cat}</button>
                        ))}
                      </div>
                      <button onClick={() => saveEdit(task.id)} className="icon-button small"><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} className="icon-button small"><X size={12} /></button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => toggleTask(task)} className={`task-check shrink-0 ${task.completedAt ? "border-[#71d4ff] bg-[#71d4ff]" : ""}`}>
                        {task.completedAt && <Check size={11} />}
                      </button>
                      <span className={`flex-1 text-left text-sm ${task.completedAt ? "line-through text-white/38" : ""}`}>{task.title}</span>
                      <span className="hidden text-[10px] tracking-[.14em] text-white/25 sm:block">{task.category}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(task)} className="icon-button small !w-7 !h-7"><Pencil size={11} /></button>
                        <button onClick={() => deleteTask(task.id)} className="icon-button small !w-7 !h-7 text-red-400/60 hover:text-red-400"><Trash2 size={11} /></button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Insight */}
          {snapshot?.insights?.[0] ? (
            <div className="insight-panel p-6 sm:p-8">
              <span className="eyebrow orange"><TrendingUp size={13} /> INSIGHT</span>
              <h2 className="mt-8 font-display text-2xl leading-tight">{snapshot.insights[0].title}</h2>
              <p className="mt-4 text-sm leading-6 text-white/48">{snapshot.insights[0].description}</p>
            </div>
          ) : (
            <div className="insight-panel p-6 sm:p-8 flex flex-col justify-center">
              <span className="eyebrow orange"><TrendingUp size={13} /> INSIGHT</span>
              <p className="mt-8 text-sm text-white/40">Os insights aparecem conforme você registra check-ins e conclui tarefas.</p>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
