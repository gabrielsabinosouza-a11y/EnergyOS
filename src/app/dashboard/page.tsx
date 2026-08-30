"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Loader2, Moon, MoonStar, Shield, Sparkles } from "lucide-react";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { useAuthRedirect } from "@/lib/auth-context";
import type { Goal, KanbanTask, KanbanLabel, Category, WeeklyPlan as WeeklyPlanType, FocusSession, UserXP, KanbanStatus, StreakDayStatus } from "@/types";
import type { DashboardSnapshotResponse } from "@/lib/db/dashboard";
import { api } from "@/lib/api-client";
import { todayIso, weekStartIso } from "@/lib/db/dates";
import { DailyQuestsProvider, useDailyQuests } from "@/lib/quest-store";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { WeeklyPlan } from "@/components/dashboard/weekly-plan";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { FocusTimer } from "@/components/dashboard/focus-timer";
import { XPBadge } from "@/components/dashboard/xp-badge";
import { DailyQuestsWidget } from "@/components/dashboard/daily-quests";
import { RecurringDailyTasks } from "@/components/dashboard/recurring-daily-tasks";

import type { Variants } from "framer-motion";

const fadeUp: Variants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

const SLEEP_OPTIONS = [
  { label: "Menos de 6h", sublabel: "Descanso insuficiente", hours: 5, icon: Moon, color: "#f87171", bgColor: "rgba(248,113,113,.08)" },
  { label: "6 a 7 horas", sublabel: "Pode melhorar", hours: 6.5, icon: Moon, color: "#fbbf24", bgColor: "rgba(251,191,36,.08)" },
  { label: "7 a 8 horas", sublabel: "Ideal para foco", hours: 7.5, icon: MoonStar, color: "#71d4ff", bgColor: "rgba(113,212,255,.08)" },
  { label: "Mais de 8h", sublabel: "Descanso completo", hours: 8.5, icon: MoonStar, color: "#b69cff", bgColor: "rgba(182,156,255,.08)" },
] as const;

function todayLabel() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${name.split(" ")[0]}`;
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
  return (
    <DailyQuestsProvider>
      <DashboardContent />
    </DailyQuestsProvider>
  );
}

function DashboardContent() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion();
  // Centralized, reactive quest state — shared with DailyQuestsWidget,
  // RecurringDailyTasks and the focus/kanban flows via DailyQuestsProvider.
  const { applyMetric, refresh: refreshQuests } = useDailyQuests();
  const [snapshot, setSnapshot] = useState<DashboardSnapshotResponse | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);
  const [kanbanLabels, setKanbanLabels] = useState<KanbanLabel[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [focusData, setFocusData] = useState<{ history: FocusSession[]; todayStats: { minutesFocused: number; coinsEarned: number }; xp: UserXP } | null>(null);
  const [coins, setCoins] = useState(0);
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
          .then((data) => { if (!cancelled) { setSnapshot(data); } })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, metrics: "Nao foi possivel carregar as medias." })); }),
        api.getGoals()
          .then((bundles) => { if (!cancelled) setGoals(bundles.map((b) => b.goal)); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, goals: "Erro ao carregar metas." })); }),
        api.getKanban()
          .then((data) => { if (!cancelled) { setKanbanTasks(data.tasks); setKanbanLabels(data.labels); } })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, kanban: "Erro ao carregar kanban." })); }),
        api.getCategories()
          .then((data) => { if (!cancelled) setCategories(data.categories); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, kanban: "Erro ao carregar categorias." })); }),
        api.getWeeklyPlans(weekStartIso(todayIso()))
          .then((p) => { if (!cancelled) setWeeklyPlans(p); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, plans: "Erro ao carregar planos." })); }),
        api.getFocusData()
          .then((f) => { if (!cancelled) setFocusData(f); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, focus: "Erro ao carregar dados de foco." })); }),
        api.getSettings()
          .then((s) => { if (!cancelled) setCoins(s.coins ?? 0); })
          .catch(() => { if (!cancelled) setSectionErrors((p) => ({ ...p, quests: "Erro ao carregar moedas." })); }),
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

  async function refreshXpForDailyTask() {
    try {
      const f = await api.getFocusData();
      if (f) setFocusData(f);
    } catch {
      // ignore
    }
  }

  async function moveKanbanTask(id: number, newStatus: KanbanStatus, newPosition: number) {
    const prev = kanbanTasks;
    // Optimistic update: update the moved task
    setKanbanTasks((ks) => ks.map((k) => k.id === id ? { ...k, status: newStatus, position: newPosition } : k));
    // Optimistic mission bump when a card reaches "Feito" for the first time
    // (the server records the same metric only on this transition).
    const prevTask = prev.find((k) => k.id === id);
    const enteringDone = newStatus === "done" && prevTask?.status !== "done";
    if (enteringDone) applyMetric("TASKS_COMPLETED", { incrementBy: 1 });
    try {
      await api.moveKanbanTask(id, newStatus, newPosition);
      // Re-fetch all tasks to get the updated positions from the server
      const updatedTasks = await api.getKanban();
      setKanbanTasks(updatedTasks.tasks);
      if (enteringDone) void refreshQuests();
    } catch {
      setKanbanTasks(prev);
      if (enteringDone) void refreshQuests();
    }
  }

  async function createKanbanTask(task: Omit<KanbanTask, "id" | "profileId" | "category" | "createdAt" | "updatedAt">) {
    try {
      const result = await api.createKanbanTask(task);
      setKanbanTasks((prev) => [...prev, result.task]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel criar o card.");
    }
  }

  async function updateKanbanTask(id: number, updates: Partial<Omit<KanbanTask, "id" | "profileId" | "category" | "createdAt" | "updatedAt">>) {
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

  async function togglePlanCompleted(id: number, completed: boolean) {
    try {
      const result = await api.setWeeklyPlanCompleted(id, completed);
      setWeeklyPlans((ps) => ps.map((p) => p.id === id ? result.plan : p));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel atualizar o plano.");
    }
  }

  async function updatePlan(id: number, title: string, categoryId: number, planDate: string) {
    try {
      const result = await api.updateWeeklyPlan(id, { title, categoryId, planDate });
      setWeeklyPlans((ps) => ps.map((p) => p.id === id ? result.plan : p));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel atualizar o plano.");
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

  async function createPlan(planDate: string, title: string, categoryId: number) {
    try {
      const result = await api.createWeeklyPlan({ planDate, title, categoryId });
      setWeeklyPlans((prev) => [...prev, result.plan]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel criar o plano.");
    }
  }

  async function startFocus(targetDurationMinutes: number, taskId?: number, energyType?: string) {
    const result = await api.startFocus(targetDurationMinutes, taskId, energyType);
    return result;
  }

  async function endFocus(sessionId: number, focusedSeconds: number) {
    // Optimistic: advance the focus-related missions in the SAME interaction —
    // the missões diárias progress bars update instantly and the claim-ready
    // glow appears the moment a mission completes. The server records the same
    // metrics (and rolls the streak forward on full-duration sessions);
    // refreshQuests() reconciles with the authoritative response.
    const minutes = Math.max(1, Math.round(focusedSeconds / 60));
    applyMetric("SESSIONS_COMPLETED", { incrementBy: 1 });
    applyMetric("TOTAL_MINUTES", { incrementBy: minutes });
    if (minutes >= 60) applyMetric("LONG_SESSION_60", { incrementBy: 1 });
    try {
      const result = await api.endFocus(sessionId, focusedSeconds);
      void refreshQuests();
      api.getFocusData().then((f) => setFocusData(f));
      // Re-pull the snapshot so the streak badge reflects the (possibly new)
      // streak right away — the server already ran the real-time evaluation.
      void fetchDashboard();
      return result;
    } catch (error) {
      // Roll the optimistic mission bumps back to server truth.
      void refreshQuests();
      throw error;
    }
  }

  /** Otimista: atualiza o progresso local e persiste no servidor. */
  function adjustGoalProgress(goalId: number, delta: number) {
    setGoals((gs) =>
      gs.map((g) => {
        if (g.id !== goalId) return g;
        const next = Math.max(0, Math.min(g.targetValue, Number((g.currentValue + delta).toFixed(2))));
        return { ...g, currentValue: next };
      }),
    );
    const target = goals.find((g) => g.id === goalId);
    if (!target) return;
    const next = Math.max(0, Math.min(target.targetValue, Number((target.currentValue + delta).toFixed(2))));
    api.updateGoal(goalId, { currentValue: next }).catch(() => {
      // Roll back to server truth on failure.
      api.getGoals().then((bundles) => setGoals(bundles.map((b) => b.goal))).catch(() => {});
    });
  }

  const displayName = user?.displayName ?? snapshot?.user.displayName ?? "voce";

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
              {snapshot?.streak && (
                <StreakBadge
                  streak={snapshot.streak.currentStreak}
                  todayStatus={snapshot.streak.todayStatus ?? null}
                  yesterdayStatus={snapshot.streak.yesterdayStatus ?? null}
                  shieldCount={snapshot.streak.shieldCount}
                  shouldPop={streakPop}
                />
              )}
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

        {/* Daily Quests */}
        <section className="mb-8">
          <DailyQuestsWidget
            coins={coins}
            onCoinsChange={setCoins}
          />
        </section>

        {/* Recurring Daily Tasks */}
        <section className="mb-8">
          <RecurringDailyTasks
            coins={coins}
            onCoinsChange={setCoins}
            onXpGain={refreshXpForDailyTask}
          />
        </section>

        {/* Weekly Plan */}
        <section className="mb-8">
          <WeeklyPlan plans={weeklyPlans} categories={categories} onDelete={deletePlan} onCreate={createPlan} onUpdate={updatePlan} onToggleCompleted={togglePlanCompleted} />
        </section>

        {/* Kanban */}
        <section className="mb-8">
          <KanbanBoard
            tasks={kanbanTasks}
            labels={kanbanLabels}
            categories={categories}
            onMove={moveKanbanTask}
            onCreate={createKanbanTask}
            onUpdate={updateKanbanTask}
            onDelete={deleteKanbanTask}
            onCreateLabel={createKanbanLabel}
            onDeleteLabel={deleteKanbanLabel}
          />
        </section>

        {/* Focus + Goals */}
        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <FocusTimer
            todayStats={focusData?.todayStats ?? { minutesFocused: 0, coinsEarned: 0 }}
            history={focusData?.history ?? []}
            onStart={startFocus}
            onEnd={endFocus}
          />
          <GoalsCard goals={goals} onAdjust={adjustGoalProgress} />
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

type StreakBadgeState = "saved" | "protected" | "lost";

function StreakBadge({
  streak,
  todayStatus,
  yesterdayStatus,
  shieldCount,
  shouldPop,
}: {
  streak: number;
  todayStatus: StreakDayStatus | null;
  yesterdayStatus: StreakDayStatus | null;
  shieldCount: number;
  shouldPop: boolean;
}) {
  const progress = Math.min(streak / 30, 1);
  const circumference = 2 * Math.PI * 19;
  const offset = circumference - progress * circumference;

  const protectedNow = todayStatus === "protected" || yesterdayStatus === "protected";
  const state: StreakBadgeState = protectedNow ? "protected" : streak > 0 ? "saved" : "lost";

  const iconSrc = state === "lost"
    ? "/streak/streak_lost.png"
    : state === "protected"
      ? "/streak/streak_protected.png"
      : "/streak/streak_alive.png";

  const statusLabel = state === "protected"
    ? shieldCount > 0
      ? `Sua sequência foi protegida por um escudo — você ainda tem ${shieldCount} escudo${shieldCount > 1 ? "s" : ""}!`
      : "Sua sequência foi protegida por um escudo!"
    : state === "lost"
      ? "Você perdeu sua sequência — não desista!"
      : streak > 0
        ? "Sua sequência está ativa!"
        : "Complete suas tarefas para começar sua sequência!";

  const dayLabel = streak === 1 ? "1 dia" : `${streak} dias`;

  // Portal-based tooltip so it is never trapped inside the check-in card's
  // `overflow-hidden` / stacking context. Positioned from the badge's on-screen
  // bounds, flipping to the left when it would run off the right viewport edge.
  const badgeRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number; tail: number } | null>(null);

  const BALLOON_W = 240;
  const updateTip = useCallback(() => {
    const el = badgeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 12;
    const anchorX = (rect.left + rect.right) / 2;
    const left = Math.min(Math.max(anchorX - BALLOON_W / 2, 8), window.innerWidth - BALLOON_W - 8);
    const tail = Math.min(Math.max(anchorX - left, 18), BALLOON_W - 18);
    setTipPos({
      top: Math.min(rect.bottom + gap, window.innerHeight - 48),
      left,
      tail,
    });
  }, []);

  const open = useCallback(() => {
    updateTip();
  }, [updateTip]);

  useEffect(() => {
    if (!tipPos) return;
    const reposition = () => updateTip();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [tipPos, updateTip]);

  return (
    <>
      <div
        ref={badgeRef}
        className={`streak-badge state-${state} ${shouldPop ? "pop" : ""}`}
        tabIndex={0}
        onPointerEnter={open}
        onPointerLeave={() => setTipPos(null)}
        onFocus={open}
        onBlur={() => setTipPos(null)}
        aria-describedby="streak-tooltip"
      >
        <div className="flame-ring">
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
            {/* Background ring */}
            <circle
              cx="24" cy="24" r="19"
              fill="none"
              stroke="rgba(255,184,107,.12)"
              strokeWidth="3"
            />
            {/* Progress ring */}
            <circle
              cx="24" cy="24" r="19"
              fill="none"
              stroke="var(--orange)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 24 24)"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="flame-value">
            <Image src={iconSrc} alt={statusLabel} title={statusLabel} width={30} height={30} style={{ objectFit: "contain" }} unoptimized className="streak-flame" draggable={false} />
            {state === "protected" && (
              <span className="streak-shield-mark" title={statusLabel}>
                <Shield size={11} strokeWidth={2.5} fill="currentColor" />
              </span>
            )}
          </div>
          {shieldCount > 0 && (
            <span className="streak-shield-count" title={`${shieldCount} escudo${shieldCount > 1 ? "s" : ""} disponíve${shieldCount > 1 ? "is" : "l"}`}>
              <span>{shieldCount}</span>
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-sm font-bold leading-tight text-[var(--orange)]">{dayLabel}</span>
          <span className="text-[10px] leading-tight text-[var(--text-faint)]">sequência</span>
        </div>
      </div>

      {tipPos &&
        createPortal(
          <div
            id="streak-tooltip"
            role="status"
            className="streak-balloon"
            style={{ top: tipPos.top, left: tipPos.left }}
          >
            <span className="streak-balloon__tail" style={{ left: tipPos.tail }} />
            <span className="streak-balloon__label">{statusLabel}</span>
          </div>,
          document.body,
        )}
    </>
  );
}
