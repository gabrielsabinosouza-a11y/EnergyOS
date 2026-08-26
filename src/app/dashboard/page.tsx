"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Flame, Loader2, Moon, MoonStar, RefreshCw, Sparkles, Target, Timer, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import Link from "next/link";
import type { Task, TaskCategory, Metric, Goal, KanbanTask, KanbanLabel, WeeklyPlan as WeeklyPlanType, FocusSession, UserXP, KanbanCategory, KanbanStatus } from "@/types";
import type { DashboardSnapshotResponse } from "@/lib/db/dashboard";
import { api } from "@/lib/api-client";
import { weekStartIso } from "@/lib/db/dates";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { TodoList } from "@/components/dashboard/todo-list";
import { WeeklyPlan } from "@/components/dashboard/weekly-plan";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { FocusTimer } from "@/components/dashboard/focus-timer";
import { XPBadge } from "@/components/dashboard/xp-badge";
import { AnimatedNumber, ProgressBar } from "@/components/ui";

import type { Variants } from "framer-motion";

const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp: Variants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

const SLEEP_OPTIONS = [
  { label: "Menos de 6h", sublabel: "Descanso insuficiente", hours: 5, icon: Moon, color: "#f87171", bgColor: "rgba(248,113,113,.08)" },
  { label: "6 a 7 horas", sublabel: "Pode melhorar", hours: 6.5, icon: Moon, color: "#fbbf24", bgColor: "rgba(251,191,36,.08)" },
  { label: "7 a 8 horas", sublabel: "Ideal para foco", hours: 7.5, icon: MoonStar, color: "#71d4ff", bgColor: "rgba(113,212,255,.08)" },
  { label: "Mais de 8h", sublabel: "Descanso completo", hours: 8.5, icon: MoonStar, color: "#b69cff", bgColor: "rgba(182,156,255,.08)" },
] as const;

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

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="metric-sparkline">
      {values.map((v, i) => (
        <motion.div
          key={i}
          className="bar"
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: color, opacity: 0.3 + (i / values.length) * 0.7 }}
        />
      ))}
    </div>
  );
}

function Toast({ message, type, onDismiss }: { message: string; type: "error" | "success"; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`toast ${type}`}
    >
      <span>{message}</span>
      {type === "error" && (
        <button className="toast-action" onClick={onDismiss}>
          OK
        </button>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion();
  const [snapshot, setSnapshot] = useState<DashboardSnapshotResponse | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);
  const [kanbanLabels, setKanbanLabels] = useState<KanbanLabel[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanType[]>([]);
  const [focusData, setFocusData] = useState<{ history: FocusSession[]; todayStats: { minutesFocused: number; coinsEarned: number }; xp: UserXP } | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [sleepAnswer, setSleepAnswer] = useState("7 a 8 horas");
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [streakPop, setStreakPop] = useState(false);
  const prevStreakRef = useRef(0);

  useEffect(() => {
    const currentStreak = snapshot?.streak.currentStreak ?? 0;
    if (currentStreak > prevStreakRef.current && currentStreak > 0) {
      setStreakPop(true);
      const t = setTimeout(() => setStreakPop(false), 500);
      return () => clearTimeout(t);
    }
    prevStreakRef.current = currentStreak;
  }, [snapshot?.streak.currentStreak]);

  const showError = useCallback((message: string) => {
    setToast({ message, type: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: "success" });
  }, []);

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
    } catch {
      setSectionErrors((prev) => ({ ...prev, metrics: "Nao foi possivel carregar as medias." }));
    } finally {
      setLoadingPage(false);
    }
  }

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    user.getIdToken().then((token) => {
      if (cancelled) return;
      Promise.allSettled([
        fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.ok ? r.json() : Promise.reject())
          .then((data) => { if (!cancelled) { setSnapshot(data); setTasks(data.tasks); } })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, metrics: "Nao foi possivel carregar as medias." })); }),
        api.getGoals()
          .then((bundles) => { if (!cancelled) setGoals(bundles.map((b) => b.goal)); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, goals: "Erro ao carregar metas." })); }),
        api.getKanban()
          .then((data) => { if (!cancelled) { setKanbanTasks(data.tasks); setKanbanLabels(data.labels); } })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, kanban: "Erro ao carregar kanban." })); }),
        api.getWeeklyPlans(weekStartIso(new Date().toISOString().slice(0, 10)))
          .then((p) => { if (!cancelled) setWeeklyPlans(p); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, plans: "Erro ao carregar planos." })); }),
        api.getFocusData()
          .then((f) => { if (!cancelled) setFocusData(f); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, focus: "Erro ao carregar dados de foco." })); }),
      ]).finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid]);

  async function saveCheckin() {
    const opt = SLEEP_OPTIONS.find((o) => o.label === sleepAnswer);
    const sleepHours = opt?.hours ?? 7.5;
    setCheckinSaving(true);
    setCheckinSaved(false);
    try {
      await api.saveCheckin({ sleepHours });
      setCheckinSaved(true);
      showSuccess("Check-in salvo!");
      await fetchDashboard();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel salvar o check-in.");
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
      showError(error instanceof Error ? error.message : "Nao foi possivel atualizar a tarefa.");
    }
  }

  async function deleteTask(id: number) {
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (error) {
      setTasks(previousTasks);
      showError(error instanceof Error ? error.message : "Nao foi possivel excluir a tarefa.");
    }
  }

  async function createTask(title: string, category: TaskCategory) {
    try {
      const result = await api.createTask({ title, category });
      setTasks((prev) => [...prev, result.task]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel criar a tarefa.");
    }
  }

  async function updateTask(id: number, title: string, category: TaskCategory) {
    try {
      const result = await api.updateTask(id, { title, category });
      setTasks((prev) => prev.map((item) => item.id === id ? result.task : item));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel editar a tarefa.");
    }
  }

  async function promoteTask(taskId: number) {
    try {
      const result = await api.promoteTaskToKanban(taskId);
      setKanbanTasks((prev) => [...prev, result.task]);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completedAt: new Date().toISOString() } : t));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel promover a tarefa.");
    }
  }

  async function moveKanbanTask(id: number, newStatus: KanbanStatus, newPosition: number) {
    const prev = kanbanTasks;
    setKanbanTasks((ks) => ks.map((k) => k.id === id ? { ...k, status: newStatus, position: newPosition } : k));
    try {
      const result = await api.updateKanbanTask(id, { status: newStatus, position: newPosition });
      setKanbanTasks((ks) => ks.map((k) => k.id === id ? result.task : k));
    } catch {
      setKanbanTasks(prev);
    }
  }

  async function createKanbanTask(task: Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">) {
    try {
      const result = await api.createKanbanTask(task);
      setKanbanTasks((prev) => [...prev, result.task]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel criar o card.");
    }
  }

  async function updateKanbanTask(id: number, updates: Partial<Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">>) {
    const prev = kanbanTasks;
    setKanbanTasks((ks) => ks.map((k) => k.id === id ? { ...k, ...updates } : k));
    try {
      const result = await api.updateKanbanTask(id, updates);
      setKanbanTasks((ks) => ks.map((k) => k.id === id ? result.task : k));
    } catch (error) {
      setKanbanTasks(prev);
      showError(error instanceof Error ? error.message : "Nao foi possivel atualizar o card.");
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

  async function createKanbanLabel(name: string, color: string) {
    try {
      const result = await api.createKanbanLabel({ name, color });
      setKanbanLabels((prev) => [...prev, result.label]);
      return result.label;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel criar a etiqueta.");
      throw error;
    }
  }

  async function deleteKanbanLabel(id: number) {
    const prev = kanbanLabels;
    setKanbanLabels((ls) => ls.filter((l) => l.id !== id));
    try {
      await api.deleteKanbanLabel(id);
    } catch {
      setKanbanLabels(prev);
    }
  }

  async function completePlan(id: number) {
    try {
      const result = await api.completeWeeklyPlan(id);
      setWeeklyPlans((ps) => ps.map((p) => p.id === id ? result.plan : p));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel concluir o plano.");
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
      showError(error instanceof Error ? error.message : "Nao foi possivel criar o plano.");
    }
  }

  async function startFocus(targetDurationMinutes: number, taskId?: number) {
    const result = await api.startFocus(targetDurationMinutes, taskId);
    return result;
  }

  async function endFocus(sessionId: number, focusedSeconds: number) {
    const result = await api.endFocus(sessionId, focusedSeconds);
    api.getFocusData().then((f) => setFocusData(f));
    return result;
  }

  const completed = tasks.filter((t) => Boolean(t.completedAt)).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const streakQualified = percentage >= 50;
  const streak = snapshot?.streak.currentStreak ?? 0;
  const displayName = user?.displayName ?? snapshot?.user.displayName ?? "voce";

  const checkins = snapshot?.checkins ?? [];
  const sparkData: Record<string, number[]> = {
    sleep: checkins.slice(-7).map((c) => c.sleepHours ?? 0),
    study: checkins.slice(-7).map((c) => c.studyMinutes ?? 0),
    training: checkins.slice(-7).map((c) => c.trainingMinutes ?? 0),
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (loadingPage) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <p className="mb-2 text-[10px] uppercase tracking-[.2em] text-[var(--accent)]">{todayLabel()}</p>
            <h1 className="font-display text-2xl tracking-[-.04em] sm:text-3xl text-[var(--text)]">
              {greeting(displayName)}<span className="text-[var(--orange)]">.</span>
            </h1>
          </motion.div>
          <div className="flex items-center gap-3">
            {focusData?.xp && <XPBadge xp={focusData.xp.totalXP} level={focusData.xp.level} />}
          </div>
        </header>

        {/* Check-in + Streak */}
        <motion.section
          variants={fadeUp} initial="hidden" animate="visible"
          className="question-panel relative mb-8 overflow-hidden p-6 sm:p-8"
        >
          {/* Ambient glow */}
          <span aria-hidden className="ambient-glow" style={{ width: 300, height: 300, top: -100, right: -60, background: "rgba(113,212,255,.12)" }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="eyebrow"><Sparkles size={13} /> CHECK-IN DIARIO</span>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Isso nos ajuda a ajustar suas metas de foco hoje</p>
              </div>
              {streak > 0 && <StreakBadge streak={streak} shouldPop={streakPop} />}
            </div>

            <h2 className="font-display text-lg sm:text-xl text-[var(--text-secondary)] mb-4">Como voce dormiu na noite passada?</h2>

            <div className="grid gap-2 sm:grid-cols-4 mb-5">
              {SLEEP_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = sleepAnswer === opt.label;
                return (
                  <motion.button
                    key={opt.label}
                    onClick={() => setSleepAnswer(opt.label)}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    whileHover={reduced ? undefined : { y: -1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`sleep-pill ${isSelected ? "selected" : ""}`}
                    style={isSelected ? { borderColor: opt.color, background: opt.bgColor, boxShadow: `0 0 24px ${opt.color}30` } : undefined}
                  >
                    <motion.div
                      className="pill-icon"
                      style={{ color: opt.color }}
                      animate={isSelected ? { scale: 1.15 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <Icon size={22} fill={isSelected ? "currentColor" : "none"} />
                    </motion.div>
                    <span className="pill-label font-medium">{opt.label}</span>
                    <span className="text-[9px] text-[var(--text-faint)]">{opt.sublabel}</span>
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              onClick={saveCheckin}
              disabled={checkinSaving}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              whileHover={reduced ? undefined : { scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="primary-button"
            >
              {checkinSaving ? <Loader2 size={15} className="animate-spin" /> : checkinSaved ? <Check size={15} /> : <Check size={15} />}
              {checkinSaved ? "Check-in salvo" : "Salvar check-in"}
            </motion.button>
          </div>
        </motion.section>

        {/* Metrics */}
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <span className="eyebrow muted">ULTIMOS 7 DIAS</span>
              <h2 className="mt-2 font-display text-lg text-[var(--text-secondary)]">Medias da semana</h2>
            </div>
            <Link href="/relatorio" className="text-button">Ver relatorio <ArrowUpRight size={15} /></Link>
          </div>

          {sectionErrors.metrics ? (
            <div className="panel p-6 text-center">
              <p className="text-sm text-[var(--text-muted)] mb-3">{sectionErrors.metrics}</p>
              <button
                onClick={() => { setSectionErrors((p) => { const n = { ...p }; delete n.metrics; return n; }); fetchDashboard(); }}
                className="text-button text-xs"
              >
                <RefreshCw size={13} /> Tentar novamente
              </button>
            </div>
          ) : snapshot?.metrics && snapshot.metrics.length > 0 ? (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="grid gap-3 md:grid-cols-3">
              {snapshot.metrics.map((m) => {
                const Icon = METRIC_ICONS[m.kind] ?? Sparkles;
                const color = METRIC_COLORS[m.kind] ?? "var(--accent)";
                const glowMap: Record<string, string> = { sleep: "rgba(113,212,255,.12)", study: "rgba(182,156,255,.12)", training: "rgba(255,184,107,.12)" };
                const trendUp = m.trend !== undefined && m.trend > 0;
                const trendDown = m.trend !== undefined && m.trend < 0;
                return (
                  <motion.div
                    key={m.kind}
                    variants={fadeUp}
                    whileHover={reduced ? undefined : { y: -2, transition: { duration: 0.15 } }}
                    className="metric-card relative overflow-hidden"
                    style={{ boxShadow: `0 0 32px -8px ${color}30` }}
                  >
                    <span aria-hidden className="ambient-glow" style={{ width: 160, height: 160, top: -60, right: -40, background: glowMap[m.kind] ?? "transparent" }} />
                    <div className="relative z-10">
                      <div className="mb-3 flex justify-between items-start">
                        <div className="metric-icon" style={{ color }}><Icon size={17} /></div>
                        {m.trend !== undefined && (
                          <motion.span
                            initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                            className="font-mono text-[11px]"
                            style={{ color: trendUp ? "var(--green)" : trendDown ? "var(--red)" : "var(--text-faint)" }}
                          >
                            {trendUp ? "+" : ""}{m.trend}%
                          </motion.span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mb-1">{m.label}</div>
                      <div className="font-display text-xl tracking-[-0.02em] text-[var(--text)]">
                        <AnimatedNumber
                          value={m.unit === "h" ? m.value : Math.round(m.value)}
                          decimals={m.unit === "h" ? 1 : 0}
                          suffix={m.unit === "h" ? "h" : m.unit === "min" ? "min" : ""}
                        />
                      </div>
                      <MiniSparkline values={sparkData[m.kind] ?? []} color={color} />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="panel p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">Nenhum dado ainda — comece seu primeiro foco hoje</p>
            </div>
          )}
        </section>

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

        {/* Kanban */}
        <section className="mb-8">
          <KanbanBoard
            tasks={kanbanTasks}
            labels={kanbanLabels}
            onMove={moveKanbanTask}
            onCreate={createKanbanTask}
            onUpdate={updateKanbanTask}
            onDelete={deleteKanbanTask}
            onCreateLabel={createKanbanLabel}
            onDeleteLabel={deleteKanbanLabel}
          />
        </section>

        {/* Focus Timer + Insight */}
        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-1">
            <FocusTimer
              todayStats={focusData?.todayStats ?? { minutesFocused: 0, coinsEarned: 0 }}
              history={focusData?.history ?? []}
              onStart={startFocus}
              onEnd={endFocus}
            />
          </div>
          <div className="lg:col-span-1">
            {/* Insight */}
            {snapshot?.insights?.[0] ? (
              <div className="insight-panel p-6 h-full">
                <span className="eyebrow orange"><TrendingUp size={13} /> INSIGHT</span>
                <h2 className="mt-5 font-display text-base leading-tight text-[var(--text-secondary)]">{snapshot.insights[0].title}</h2>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{snapshot.insights[0].description}</p>
              </div>
            ) : (
              <div className="insight-panel p-6 flex flex-col justify-center h-full">
                <span className="eyebrow orange"><TrendingUp size={13} /> INSIGHT</span>
                <p className="mt-5 text-xs text-[var(--text-muted)]">Os insights aparecem conforme voce registra check-ins e conclui tarefas.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function StreakBadge({ streak, shouldPop }: { streak: number; shouldPop: boolean }) {
  const progress = Math.min(streak / 30, 1);
  const circumference = 2 * Math.PI * 11;
  const offset = circumference - progress * circumference;

  return (
    <div className={`streak-badge ${shouldPop ? "pop" : ""}`}>
      <div className="flame-ring">
        <svg width="28" height="28" viewBox="0 0 28 28">
          {/* Background ring */}
          <circle
            cx="14" cy="14" r="11"
            fill="none"
            stroke="rgba(255,184,107,.12)"
            strokeWidth="2.5"
          />
          {/* Progress ring */}
          <circle
            cx="14" cy="14" r="11"
            fill="none"
            stroke="var(--orange)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 14 14)"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="flame-value">
          <Flame size={12} fill="currentColor" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-xs font-bold text-[var(--orange)]">{streak} dias</span>
        <span className="text-[9px] text-[var(--text-faint)]">sequencia</span>
      </div>
    </div>
  );
}
