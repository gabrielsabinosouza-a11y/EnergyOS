"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Moon,
  Timer,
  Target,
  Heart,
  Zap,
  Power,
  Minus,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Goal, Habit, GoalCategory } from "@/types";
import type { HabitWithCompletion } from "@/lib/db";
import { api } from "@/lib/api-client";

const CATEGORY_META: Record<GoalCategory, { label: string; color: string; icon: React.ElementType }> = {
  sono:   { label: "Sono",   color: "#71d4ff", icon: Moon },
  estudo: { label: "Estudo", color: "#b69cff", icon: Timer },
  treino: { label: "Treino", color: "#ffb86b", icon: Target },
  saude:  { label: "Saúde",  color: "#6bffb8", icon: Heart },
  foco:   { label: "Foco",   color: "#ff9f6b", icon: Zap },
};

const FREQ_LABELS: Record<Goal["frequency"], string> = {
  daily: "Diária", weekly: "Semanal", monthly: "Mensal",
};

const HABIT_FREQ_LABELS: Record<Habit["frequency"], string> = {
  daily: "Diário", weekly: "Semanal",
};

type HabitFrequency = Habit["frequency"];
type GoalDraft = Omit<Goal, "id" | "profileId" | "currentValue">;
type HabitDraft = { frequency: HabitFrequency };

const emptyDraft = (): GoalDraft => ({
  title: "", category: "foco", targetValue: 1, frequency: "daily",
});

export default function MetasPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<HabitWithCompletion[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft());
  const [habitInput, setHabitInput] = useState("");
  const [habitDraft, setHabitDraft] = useState<HabitDraft>({ frequency: "daily" });
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function applyLoaded(bundles: Awaited<ReturnType<typeof api.getGoals>>) {
    setGoals(bundles.map((bundle) => bundle.goal));
    setHabits(bundles.flatMap((bundle) => bundle.habits));
  }

  async function reload() {
    if (!user) return;
    try {
      applyLoaded(await api.getGoals());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar metas.");
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    api.getGoals()
      .then((bundles) => {
        if (cancelled) return;
        applyLoaded(bundles);
        setError("");
        setPageLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar metas.");
        setPageLoading(false);
      });
    return () => { cancelled = true; };
  }, [loading, user]);

  if (loading || pageLoading) return <LoadingScreen />;
  if (!user) { router.push("/login"); return null; }

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      await reload();
    }
  }

  function openCreate() {
    setEditingGoal(null);
    setDraft(emptyDraft());
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setDraft({ title: goal.title, category: goal.category, targetValue: goal.targetValue, frequency: goal.frequency });
    setShowForm(true);
  }

  async function saveGoal() {
    if (!draft.title.trim()) return;
    setSaving(true);
    await run(async () => {
      if (editingGoal) {
        await api.updateGoal(editingGoal.id, draft);
      } else {
        await api.createGoal(draft);
      }
      await reload();
    });
    setSaving(false);
    setShowForm(false);
    setEditingGoal(null);
  }

  async function deleteGoal(id: number) {
    await run(async () => {
      await api.deleteGoal(id);
      setGoals((gs) => gs.filter((g) => g.id !== id));
      setHabits((hs) => hs.filter((h) => h.goalId !== id));
      if (expandedGoal === id) setExpandedGoal(null);
    });
  }

  async function adjustProgress(goal: Goal, delta: number) {
    const next = Math.max(0, Math.min(goal.targetValue, Number((goal.currentValue + delta).toFixed(2))));
    if (next === goal.currentValue) return;
    setGoals((gs) => gs.map((g) => (g.id === goal.id ? { ...g, currentValue: next } : g)));
    await run(() => api.updateGoal(goal.id, { currentValue: next }));
  }

  async function addHabit(goalId: number) {
    if (!habitInput.trim()) return;
    await run(async () => {
      const { habit } = await api.createHabit(goalId, { title: habitInput.trim(), frequency: habitDraft.frequency });
      setHabits((hs) => [...hs, habit]);
    });
    setHabitInput("");
  }

  async function toggleHabitCompletion(habit: HabitWithCompletion) {
    const willComplete = !habit.completedToday;
    setHabits((hs) => hs.map((h) => (h.id === habit.id ? { ...h, completedToday: willComplete } : h)));
    await run(() => api.setHabitCompletion(habit.id, willComplete));
  }

  async function toggleHabitActive(habit: HabitWithCompletion) {
    setHabits((hs) => hs.map((h) => (h.id === habit.id ? { ...h, active: !h.active } : h)));
    await run(() => api.updateHabit(habit.id, { active: !habit.active }));
  }

  async function deleteHabit(id: number) {
    setHabits((hs) => hs.filter((h) => h.id !== id));
    await run(() => api.deleteHabit(id));
  }

  function setDraftField<K extends keyof GoalDraft>(k: K, v: GoalDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-[#e7f4ff]">
      <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/" className="brand-mark"><Sparkles size={17} /></Link>
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">energy<span className="text-[#71d4ff]">OS</span></span>
        </div>

        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="eyebrow muted">METAS</span>
            <h1 className="mt-2 font-display text-3xl tracking-[-0.04em]">Suas metas</h1>
          </div>
          <button onClick={openCreate} className="primary-button">
            <Plus size={15} /> Nova meta
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Form modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="question-panel p-6 mb-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="eyebrow">{editingGoal ? "EDITAR META" : "NOVA META"}</span>
                <button onClick={() => setShowForm(false)} className="icon-button small"><X size={14} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Título</label>
                  <input value={draft.title} onChange={(e) => setDraftField("title", e.target.value)} className="auth-input" placeholder="Ex: Dormir 8 horas por dia" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Categoria</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CATEGORY_META) as GoalCategory[]).map((cat) => {
                      const { label, color, icon: Icon } = CATEGORY_META[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => setDraftField("category", cat)}
                          style={draft.category === cat ? { borderColor: color, color } : {}}
                          className={`answer-option w-auto! gap-1.5 px-3 py-1.5 text-xs ${draft.category === cat ? "selected" : ""}`}
                        >
                          <Icon size={12} /> {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Valor alvo</label>
                    <input
                      type="number" min={1} value={draft.targetValue}
                      onChange={(e) => setDraftField("targetValue", Number(e.target.value))}
                      className="auth-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Frequência</label>
                    <select
                      value={draft.frequency}
                      onChange={(e) => setDraftField("frequency", e.target.value as Goal["frequency"])}
                      className="auth-input"
                    >
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                </div>

                <button onClick={saveGoal} disabled={!draft.title.trim() || saving} className="primary-button w-full justify-center">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {editingGoal ? "Salvar alterações" : "Criar meta"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista de metas */}
        {goals.length === 0 && !showForm && (
          <div className="panel p-12 text-center">
            <Target size={32} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/40 text-sm">Nenhuma meta criada ainda.</p>
            <button onClick={openCreate} className="text-button mt-4">Criar primeira meta <Plus size={13} /></button>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {goals.map((goal) => {
              const { color, icon: Icon } = CATEGORY_META[goal.category];
              const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
              const goalHabits = habits.filter((h) => h.goalId === goal.id);
              const expanded = expandedGoal === goal.id;

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="panel overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="metric-icon mt-0.5" style={{ color }}><Icon size={15} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium text-sm truncate">{goal.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEdit(goal)} className="icon-button small"><Pencil size={12} /></button>
                            <button onClick={() => deleteGoal(goal.id)} className="icon-button small text-red-400/60 hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-white/35">{CATEGORY_META[goal.category].label} · {FREQ_LABELS[goal.frequency]}</span>
                          <span className="text-xs font-mono text-white/50">{goal.currentValue}/{goal.targetValue}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="progress-track flex-1">
                            <div className="progress-value" style={{ width: `${pct}%`, boxShadow: `0 0 12px ${color}80`, background: color }} />
                          </div>
                          <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button onClick={() => adjustProgress(goal, -1)} className="icon-button small" aria-label="Diminuir progresso"><Minus size={12} /></button>
                          <button onClick={() => adjustProgress(goal, 1)} className="icon-button small" aria-label="Aumentar progresso"><Plus size={12} /></button>
                          <span className="text-xs text-white/30">atualizar progresso</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedGoal(expanded ? null : goal.id)}
                      className="mt-3 text-xs text-white/30 hover:text-[#71d4ff] transition-colors"
                    >
                      {expanded ? "Ocultar hábitos" : `Hábitos (${goalHabits.length})`}
                    </button>
                  </div>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/8"
                      >
                        <div className="p-5 pt-4">
                          <span className="eyebrow muted mb-3 block">HÁBITOS RELACIONADOS</span>
                          {goalHabits.length === 0 && (
                            <p className="text-xs text-white/30 mb-3">Nenhum hábito ainda.</p>
                          )}
                          <div className="space-y-1 mb-3">
                            {goalHabits.map((h) => (
                              <div key={h.id} className={`flex items-center gap-2 ${h.active ? "" : "opacity-50"}`}>
                                <button
                                  onClick={() => toggleHabitCompletion(h)}
                                  disabled={!h.active}
                                  className={`task-check shrink-0 ${h.completedToday ? "border-[#6bffb8]! bg-[#6bffb8]!" : ""}`}
                                  aria-label={h.completedToday ? "Desmarcar conclusão de hoje" : "Marcar como concluído hoje"}
                                >
                                  {h.completedToday && <Check size={10} />}
                                </button>
                                <span className="flex-1 min-w-0">
                                  <span className={`block text-xs ${h.completedToday ? "text-[#6bffb8]" : h.active ? "text-white/70" : "text-white/30 line-through"}`}>{h.title}</span>
                                  <span className="block text-[10px] text-white/25">{HABIT_FREQ_LABELS[h.frequency]}{h.completedToday ? " · feito hoje" : ""}</span>
                                </span>
                                <button
                                  onClick={() => toggleHabitActive(h)}
                                  className={`icon-button small ${h.active ? "text-[#71d4ff]/80" : "text-white/30"}`}
                                  aria-label={h.active ? "Desativar hábito" : "Ativar hábito"}
                                >
                                  <Power size={11} />
                                </button>
                                <button onClick={() => deleteHabit(h.id)} className="text-white/20 hover:text-red-400 transition-colors"><X size={12} /></button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={habitInput}
                              onChange={(e) => setHabitInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && void addHabit(goal.id)}
                              className="auth-input py-1.5! text-xs! flex-1"
                              placeholder="Novo hábito..."
                            />
                            <select
                              value={habitDraft.frequency}
                              onChange={(e) => setHabitDraft({ frequency: e.target.value as HabitFrequency })}
                              className="auth-input py-1.5! text-xs! w-24"
                              aria-label="Frequência do hábito"
                            >
                              <option value="daily">Diário</option>
                              <option value="weekly">Semanal</option>
                            </select>
                            <button onClick={() => void addHabit(goal.id)} className="icon-button small"><Plus size={13} /></button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
    </div>
  );
}
