"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarCheck, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import type { GoalWithProgress } from "@/lib/db/goals";
import { api } from "@/lib/api-client";
import { addDaysIso, todayIso } from "@/lib/db/dates";
import { HabitCard, type HabitTab } from "./habit-card";

const TABS: { id: HabitTab; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "geral", label: "Geral" },
  { id: "semanal", label: "Semanal" },
];

/** Dias de histórico buscados — cobre as ~20 semanas do mapa e a sequência. */
const HISTORY_DAYS = 200;

interface HabitTrackerState {
  goals: GoalWithProgress[];
  /** goalId → (date YYYY-MM-DD → amount) dos goal_logs. */
  logsByGoal: Record<number, Record<string, number>>;
  loading: boolean;
  error: string;
}

/**
 * Seção "Meus hábitos": um card por meta diária (frequência "Diária") com
 * sequência, check-in do dia e mapa próprio. Reusa o MESMO endpoint dos cards
 * de meta (POST /api/goal-logs): o servidor soma os logs do período e concede/
 * estorna XP e moedas na transição — nada de lógica de recompensa duplicada.
 */
export function HabitTracker() {
  const today = useMemo(() => todayIso(), []);
  const [tab, setTab] = useState<HabitTab>("geral");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [state, setState] = useState<HabitTrackerState>({
    goals: [],
    logsByGoal: {},
    loading: true,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const from = addDaysIso(today, -HISTORY_DAYS);
        const [bundles, logsResult] = await Promise.all([
          api.getGoals(),
          api.getGoalLogs(from, today).then(
            (r) => ({ ok: true as const, logs: r.logs }),
            () => ({ ok: false as const, logs: [] }),
          ),
        ]);
        if (cancelled) return;

        const goals = bundles.map((b) => b.goal).filter((g) => g.frequency === "daily");
        const logsByGoal: Record<number, Record<string, number>> = {};
        for (const goal of goals) logsByGoal[goal.id] = {};
        for (const log of logsResult.logs) {
          if (logsByGoal[log.goalId]) logsByGoal[log.goalId][log.date] = log.amount;
        }
        if (!logsResult.ok && goals.length > 0) {
          setState({ goals, logsByGoal, loading: false, error: "Não foi possível carregar o histórico dos hábitos." });
        } else {
          setState({ goals, logsByGoal, loading: false, error: "" });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          goals: [],
          logsByGoal: {},
          loading: false,
          error: err instanceof Error ? err.message : "Não foi possível carregar os hábitos.",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [today]);

  /**
   * Check-in do hábito. Mesma ação do card de metas (`POST /api/goal-logs`):
   * marcar = `set` no alvo do dia (atinge o período, recebe a recompensa de
   * conclusão); desmarcar = `set` 0 (remove o log, o servidor estorna).
   */
  const toggle = useCallback(
    async (goal: GoalWithProgress, date: string, done: boolean) => {
      const key = `${goal.id}:${date}`;
      if (busyKey) return;
      setBusyKey(key);
      const amount = done ? 0 : Math.max(1, goal.targetValue);
      try {
        const result = await api.postGoalLog({ goalId: goal.id, action: "set", date, amount });
        setState((prev) => {
          const forGoal = { ...(prev.logsByGoal[goal.id] ?? {}) };
          if (result.log && result.log.amount > 0) forGoal[result.log.date] = result.log.amount;
          else delete forGoal[date];
          return {
            ...prev,
            goals: prev.goals.map((g) => (g.id === goal.id ? { ...g, ...result.goal } : g)),
            logsByGoal: { ...prev.logsByGoal, [goal.id]: forGoal },
          };
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Não foi possível registrar o check-in.",
        }));
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey],
  );

  return (
    <section className="panel p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#ffb86b]/20 p-2 text-[#ffb86b]">
            <CalendarCheck size={18} />
          </div>
          <div>
            <h2 className="font-display text-xl">Meus hábitos</h2>
            <p className="text-xs text-[var(--text-muted)]">Suas metas diárias — sequência e check-in de cada uma.</p>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`cursor-pointer px-3.5 py-1.5 text-xs font-medium transition ${tab === t.id ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {state.error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={15} /> {state.error}
        </div>
      )}

      {state.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin text-[#71d4ff]" />
        </div>
      ) : state.goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Você ainda não tem metas diárias. Crie uma para começar a acompanhar sua constância aqui.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#07111f] transition hover:opacity-90"
          >
            <Plus size={15} /> Criar meta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {state.goals.map((goal) => (
            <HabitCard
              key={goal.id}
              goal={goal}
              logs={state.logsByGoal[goal.id] ?? {}}
              today={today}
              tab={tab}
              busyKey={busyKey}
              onToggle={(g, date, done) => void toggle(g, date, done)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
