"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Flame, Loader2, Moon, Sparkles, Target, Timer, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import Link from "next/link";
import type { Task, TaskCategory, Metric, Goal, KanbanTask, WeeklyPlan as WeeklyPlanType, FocusSession, UserXP, KanbanCategory } from "@/types";
import type { DashboardSnapshotResponse } from "@/lib/db/dashboard";
import { api } from "@/lib/api-client";
import { weekStartIso } from "@/lib/db/dates";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { TodoList } from "@/components/dashboard/todo-list";
import { WeeklyPlan } from "@/components/dashboard/weekly-plan";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { FocusTimer } from "@/components/dashboard/focus-timer";
import { XPBadge } from "@/components/dashboard/xp-badge";

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
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${name.split(" ")[0]}`;
}

export default function DashboardPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [snapshot, setSnapshot] = useState<DashboardSnapshotResponse | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanType[]>([]);
  const [focusData, setFocusData] = useState<{ history: FocusSession[]; todayStats: { minutesFocused: number; coinsEarned: number }; xp: UserXP } | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState("");
  const [sleepAnswer, setSleepAnswer] = useState("7 a 8 horas");
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinSaved, setCheckinSaved] = useState(false);

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

    // Fetch all data in parallel
    user.getIdToken().then((token) => {
      if (cancelled) return;
      Promise.all([
        fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.ok ? r.json() : Promise.reject())
          .then((data) => { if (!cancelled) { setSnapshot(data); setTasks(data.tasks); } }),
        api.getGoals()
          .then((bundles) => { if (!cancelled) setGoals(bundles.map((b) => b.goal)); }),
        api.getKanban()
          .then((k) => { if (!cancelled) setKanbanTasks(k); }),
        api.getWeeklyPlans(weekStartIso(new Date().toISOString().slice(0, 10)))
          .then((p) => { if (!cancelled) setWeeklyPlans(p); }),
        api.getFocusData()
          .then((f) => { if (!cancelled) setFocusData(f); }),
      ]).catch(() => {
        if (!cancelled) setError("Não foi possível carregar alguns dados.");
      }).finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid]);

  async function saveCheckin() {
    const sleepHours = sleepAnswer === "Menos de 6 horas" ? 5 : sleepAnswer === "6 a 7 horas" ? 6.5 : sleepAnswer === "7 a 8 horas" ? 7.5 : 8.5;
    setCheckinSaving(true);
    setCheckinSaved(false);
    try {
      await api.saveCheckin({ sleepHours });
      setCheckinSaved(true);
      await fetchDashboard();
    } catch (error) {
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
      const response = await api.setTaskCompleted(task.id, completed);
      setTasks((prev) => prev.map((item) => item.id === task.id ? response.task : item));
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa.");
    }
  }

  async function deleteTask(id: number) {
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Não foi possível excluir a tarefa.");
    }
  }

  async function createTask(title: string, category: TaskCategory) {
    try {
      const result = await api.createTask({ title, category });
      setTasks((prev) => [...prev, result.task]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    }
  }

  async function updateTask(id: number, title: string, category: TaskCategory) {
    try {
      const result = await api.updateTask(id, { title, category });
      setTasks((prev) => prev.map((item) => item.id === id ? result.task : item));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível editar a tarefa.");
    }
  }

  async function promoteTask(taskId: number) {
    try {
      const result = await api.promoteTaskToKanban(taskId);
      setKanbanTasks((prev) => [...prev, result.task]);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completedAt: new Date().toISOString() } : t));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível promover a tarefa.");
    }
  }

  async function moveKanbanTask(id: number, newStatus: "todo" | "doing" | "done") {
    const prev = kanbanTasks;
    setKanbanTasks((ks) => ks.map((k) => k.id === id ? { ...k, status: newStatus } : k));
    try {
      const result = await api.updateKanbanTask(id, { status: newStatus });
      setKanbanTasks((ks) => ks.map((k) => k.id === id ? result.task : k));
    } catch {
      setKanbanTasks(prev);
    }
  }

  async function createKanbanTask(title: string, category: KanbanCategory) {
    try {
      const result = await api.createKanbanTask({ title, category });
      setKanbanTasks((prev) => [...prev, result.task]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível criar o card.");
    }
  }

  async function deleteKanbanTask(id: number) {
    const prev = kanbanTasks;
    setKanbanTasks((ks) => ks.filter((k) => k.id !== id));
    try {
      await api.deleteKanbanTask(id);
    } catch {
      setKanbanTasks(prev);
    }
  }

  async function completePlan(id: number) {
    try {
      const result = await api.completeWeeklyPlan(id);
      setWeeklyPlans((ps) => ps.map((p) => p.id === id ? result.plan : p));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível concluir o plano.");
    }
  }

  async function deletePlan(id: number) {
    const prev = weeklyPlans;
    setWeeklyPlans((ps) => ps.filter((p) => p.id !== id));
    try {
      await api.deleteWeeklyPlan(id);
    } catch {
      setWeeklyPlans(prev);
    }
  }

  async function createPlan(planDate: string, title: string, category: TaskCategory) {
    try {
      const result = await api.createWeeklyPlan({ planDate, title, category });
      setWeeklyPlans((prev) => [...prev, result.plan]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível criar o plano.");
    }
  }

  async function startFocus(targetDurationMinutes: number, taskId?: number) {
    const result = await api.startFocus(targetDurationMinutes, taskId);
    return result;
  }

  async function endFocus(sessionId: number, focusedSeconds: number) {
    const result = await api.endFocus(sessionId, focusedSeconds);
    // Refresh focus data
    api.getFocusData().then((f) => setFocusData(f));
    return result;
  }

  const completed = tasks.filter((t) => Boolean(t.completedAt)).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const streakQualified = percentage >= 50;
  const streak = snapshot?.streak.currentStreak ?? 0;
  const displayName = user?.displayName ?? snapshot?.user.displayName ?? "você";

  if (loading || !user) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
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
        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[.2em] text-[#71d4ff]">{todayLabel()}</p>
            <h1 className="font-display text-3xl tracking-[-.04em] sm:text-4xl">
              {greeting(displayName)}<span className="text-[#ffb86b]">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {focusData?.xp && <XPBadge xp={focusData.xp.totalXP} level={focusData.xp.level} />}
            {streak > 0 && (
              <div className="streak"><Flame size={18} fill="currentColor" /> <span>{streak}</span><small>dias</small></div>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Check-in */}
        <section className="question-panel mb-8 p-6 sm:p-8">
          <span className="eyebrow"><Sparkles size={13} /> CHECK-IN DIÁRIO</span>
          <h2 className="mt-5 font-display text-2xl">Como você dormiu na noite passada?</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">{["Menos de 6 horas", "6 a 7 horas", "7 a 8 horas", "Mais de 8 horas"].map((answer) => <button key={answer} onClick={() => setSleepAnswer(answer)} className={`answer-option ${sleepAnswer === answer ? "selected" : ""}`}><span className="answer-dot">{sleepAnswer === answer && <span />}</span>{answer}</button>)}</div>
          <button onClick={saveCheckin} disabled={checkinSaving} className="primary-button mt-6">{checkinSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {checkinSaved ? "Check-in salvo" : "Salvar check-in"}</button>
        </section>

        {/* Metrics */}
        {snapshot?.metrics && snapshot.metrics.length > 0 && (
          <section className="mb-8">
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

        {/* Goals + Todo */}
        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <GoalsCard goals={goals} />
          <TodoList
            tasks={tasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onCreate={createTask}
            onUpdate={updateTask}
            onPromote={promoteTask}
            streakQualified={streakQualified}
          />
        </section>

        {/* Weekly Plan */}
        <section className="mb-8">
          <WeeklyPlan plans={weeklyPlans} onComplete={completePlan} onDelete={deletePlan} onCreate={createPlan} />
        </section>

        {/* Kanban + Focus */}
        <section className="mb-8 grid gap-5 xl:grid-cols-[1fr_.340px]">
          <KanbanBoard tasks={kanbanTasks} onMove={moveKanbanTask} onCreate={createKanbanTask} onDelete={deleteKanbanTask} />
          <div className="space-y-5">
            <FocusTimer
              todayStats={focusData?.todayStats ?? { minutesFocused: 0, coinsEarned: 0 }}
              history={focusData?.history ?? []}
              onStart={startFocus}
              onEnd={endFocus}
            />
            {/* Insight */}
            {snapshot?.insights?.[0] ? (
              <div className="insight-panel p-6">
                <span className="eyebrow orange"><TrendingUp size={13} /> INSIGHT</span>
                <h2 className="mt-5 font-display text-lg leading-tight">{snapshot.insights[0].title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{snapshot.insights[0].description}</p>
              </div>
            ) : (
              <div className="insight-panel p-6 flex flex-col justify-center">
                <span className="eyebrow orange"><TrendingUp size={13} /> INSIGHT</span>
                <p className="mt-5 text-sm text-[var(--text-muted)]">Os insights aparecem conforme você registra check-ins e conclui tarefas.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
