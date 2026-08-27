"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuthRedirect } from "@/lib/auth-context";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Power,
  Minus,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Link from "next/link";
import type { Category, Goal, Habit } from "@/types";
import type { HabitWithCompletion } from "@/lib/db";
import { api } from "@/lib/api-client";
import { ProgressBar } from "@/components/ui";
import { CategoryForm } from "@/components/category-form";
import { categoryIcon, sortCategoriesForPicker } from "@/lib/categories";

const FREQ_LABELS: Record<Goal["frequency"], string> = {
  daily: "Diária", weekly: "Semanal", monthly: "Mensal",
};

const HABIT_FREQ_LABELS: Record<Habit["frequency"], string> = {
  daily: "Diário", weekly: "Semanal",
};

type HabitFrequency = Habit["frequency"];
type GoalDraft = { title: string; categoryId: number; targetValue: number; frequency: Goal["frequency"] };
type HabitDraft = { frequency: HabitFrequency };

const emptyDraft = (): GoalDraft => ({
  title: "", categoryId: 0, targetValue: 1, frequency: "daily",
});

export default function MetasPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<HabitWithCompletion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft());
  const [habitInput, setHabitInput] = useState("");
  const [habitDraft, setHabitDraft] = useState<HabitDraft>({ frequency: "daily" });
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedCategories = useMemo(() => sortCategoriesForPicker(categories), [categories]);
  /** Categoria padrão do formulário: "Foco" (padrão do sistema) ou a primeira disponível. */
  const defaultCategoryId = useMemo(() => {
    const foco = categories.find((c) => !c.userId && c.name === "Foco");
    return foco?.id ?? sortedCategories[0]?.id ?? 0;
  }, [categories, sortedCategories]);

  function applyLoaded(bundles: Awaited<ReturnType<typeof api.getGoals>>) {
    setGoals(bundles.map((bundle) => bundle.goal));
    setHabits(bundles.flatMap((bundle) => bundle.habits));
  }

  async function reload() {
    if (!user) return;
    try {
      const [bundles, categoriesResult] = await Promise.all([api.getGoals(), api.getCategories()]);
      applyLoaded(bundles);
      setCategories(categoriesResult.categories);
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
    Promise.all([api.getGoals(), api.getCategories()])
      .then(([bundles, categoriesResult]) => {
        if (cancelled) return;
        applyLoaded(bundles);
        setCategories(categoriesResult.categories);
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

  if (loading || !user || pageLoading) return <LoadingScreen />;

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
    setDraft({ ...emptyDraft(), categoryId: defaultCategoryId });
    setShowCategoryForm(false);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setDraft({ title: goal.title, categoryId: goal.categoryId, targetValue: goal.targetValue, frequency: goal.frequency });
    setShowCategoryForm(false);
    setShowForm(true);
  }

  async function saveGoal() {
    if (!draft.title.trim()) return;
    setSaving(true);
    await run(async () => {
      const payload = { ...draft, categoryId: draft.categoryId || defaultCategoryId };
      if (editingGoal) {
        await api.updateGoal(editingGoal.id, payload);
      } else {
        await api.createGoal(payload);
      }
      await reload();
    });
    setSaving(false);
    setShowForm(false);
    setEditingGoal(null);
  }

  async function handleCategoryCreated(input: { name: string; color: string; icon: string | null }) {
    const { category } = await api.createCategory(input);
    setCategories((prev) => [...prev, category]);
    setDraft((d) => ({ ...d, categoryId: category.id }));
    setShowCategoryForm(false);
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

  async function setProgress(goal: Goal, value: number) {
    const next = Math.max(0, Math.min(goal.targetValue, Number(value.toFixed(2))));
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
    <main className="min-h-screen theme-bg">
      <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <ChevronLeft size={18} /> Voltar
          </Link>
          <div className="ml-auto" />
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icons_8bits/logo.png" alt="energyOS" width={24} height={24} className="pixelated" />
            <span className="font-display text-xl font-semibold tracking-[-0.04em]">energy<span className="text-[#71d4ff]">OS</span></span>
          </Link>
        </div>

        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="eyebrow muted">METAS</span>
            <h1 className="mt-2 font-display text-3xl tracking-[-0.04em]">Suas metas</h1>
          </div>
          <motion.button
            onClick={openCreate}
            whileHover={reduced ? undefined : { scale: 1.04, boxShadow: "0 0 36px rgba(113,212,255,.4)" }}
            whileTap={reduced ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="primary-button"
          >
            <Plus size={15} /> Nova meta
          </motion.button>
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Título</label>
                  <input value={draft.title} onChange={(e) => setDraftField("title", e.target.value)} className="auth-input" placeholder="Ex: Dormir 8 horas por dia" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Categoria</label>
                  <div className="flex flex-wrap gap-2">
                    {sortedCategories.map((cat) => {
                      const Icon = categoryIcon(cat.icon);
                      const selected = draft.categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setDraftField("categoryId", cat.id)}
                          style={selected ? { borderColor: cat.color, color: cat.color } : {}}
                          className={`answer-option w-auto! gap-1.5 px-3 py-1.5 text-xs ${selected ? "selected" : ""}`}
                        >
                          <Icon size={12} /> {cat.name}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setShowCategoryForm((v) => !v)}
                      aria-label="Nova categoria"
                      title="Nova categoria"
                      className={`answer-option w-auto! gap-1 px-3 py-1.5 text-xs ${showCategoryForm ? "selected" : ""}`}
                    >
                      {showCategoryForm ? <X size={12} /> : <Plus size={12} />} Nova categoria
                    </button>
                  </div>
                  {showCategoryForm && (
                    <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4">
                      <CategoryForm
                        submitLabel="Criar categoria"
                        onSubmit={handleCategoryCreated}
                        onCancel={() => setShowCategoryForm(false)}
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Quantidade</label>
                    <input
                      type="number" min={1} value={draft.targetValue}
                      onChange={(e) => setDraftField("targetValue", Number(e.target.value))}
                      className="auth-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Frequência</label>
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
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="panel relative overflow-hidden p-14 text-center"
          >
            <span aria-hidden className="ambient-glow" style={{ width: 220, height: 220, top: -60, left: "50%", transform: "translateX(-50%)", background: "rgba(182,156,255,.1)" }} />
            <motion.div
              animate={reduced ? {} : { y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--purple-bg)] bg-[var(--purple-bg)]"
            >
              <Target size={26} className="text-[var(--purple)]" />
            </motion.div>
            <p className="relative z-10 font-display text-base text-[var(--text-secondary)] mb-1">Nenhuma meta ainda</p>
            <p className="relative z-10 text-xs text-[var(--text-faint)] mb-5">Defina o que você quer alcançar e acompanhe cada passo.</p>
            <motion.button
              onClick={openCreate}
              whileHover={reduced ? undefined : { scale: 1.04, boxShadow: "0 0 36px rgba(113,212,255,.4)" }}
              whileTap={reduced ? undefined : { scale: 0.96 }}
              className="relative z-10 primary-button mx-auto"
            >
              <Plus size={14} /> Criar primeira meta
            </motion.button>
          </motion.div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {goals.map((goal) => {
              const color = goal.category.color;
              const Icon = categoryIcon(goal.category.icon);
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
                          <span className="text-xs text-[var(--text-muted)]">{goal.category.name} · {FREQ_LABELS[goal.frequency]}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <ProgressBar value={pct} color={color} glowColor={`${color}60`} />
                          <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[var(--text-faint)]">Atualizar progresso</span>
                            <span className="text-xs font-mono text-[var(--text-secondary)]">{goal.currentValue}/{goal.targetValue}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => adjustProgress(goal, -5)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)]"
                              aria-label="Diminuir 5"
                            >
                              <ChevronsLeft size={14} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => adjustProgress(goal, -1)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-active)]"
                              aria-label="Diminuir 1"
                            >
                              <ChevronLeft size={14} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              onClick={() => {
                                const newValue = prompt(`Definir progresso (0-${goal.targetValue}):`, goal.currentValue.toString());
                                if (newValue !== null) {
                                  const num = parseFloat(newValue);
                                  if (!isNaN(num) && num >= 0 && num <= goal.targetValue) {
                                    setProgress(goal, num);
                                  }
                                }
                              }}
                              className="flex h-10 min-w-[56px] items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 font-mono text-sm font-medium text-[var(--text)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] hover:shadow-[0_0_12px_rgba(113,212,255,0.15)] cursor-pointer"
                              aria-label={`Progresso atual: ${goal.currentValue}. Clique para editar.`}
                            >
                              {goal.currentValue}
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => adjustProgress(goal, 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-active)]"
                              aria-label="Aumentar 1"
                            >
                              <ChevronRight size={14} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => adjustProgress(goal, 5)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)]"
                              aria-label="Aumentar 5"
                            >
                              <ChevronsRight size={14} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedGoal(expanded ? null : goal.id)}
                      className="mt-3 text-xs text-[var(--text-faint)] hover:text-[#71d4ff] transition-colors"
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
                        className="overflow-hidden border-t border-[var(--border-subtle)]"
                      >
                        <div className="p-5 pt-4">
                          <span className="eyebrow muted mb-3 block">HÁBITOS RELACIONADOS</span>
                          {goalHabits.length === 0 && (
                            <p className="text-xs text-[var(--text-faint)] mb-3 italic">Nenhum hábito ainda — adicione um abaixo.</p>
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
                                  <span className={`block text-xs ${h.completedToday ? "text-[#6bffb8]" : h.active ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)] line-through"}`}>{h.title}</span>
                                  <span className="block text-[10px] text-[var(--text-faint)]">{HABIT_FREQ_LABELS[h.frequency]}{h.completedToday ? " · feito hoje" : ""}</span>
                                </span>
                                <button
                                  onClick={() => toggleHabitActive(h)}
                                  className={`icon-button small ${h.active ? "text-[#71d4ff]/80" : "text-[var(--text-faint)]"}`}
                                  aria-label={h.active ? "Desativar hábito" : "Ativar hábito"}
                                >
                                  <Power size={11} />
                                </button>
                                <button onClick={() => deleteHabit(h.id)} className="text-[var(--text-faint)] hover:text-red-400 transition-colors"><X size={12} /></button>
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
    <div className="min-h-screen theme-bg flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
    </div>
  );
}
