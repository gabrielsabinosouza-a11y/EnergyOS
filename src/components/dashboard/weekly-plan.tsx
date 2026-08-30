"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Check, X, Loader2 } from "lucide-react";
import type { Category, WeeklyPlan } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";
import { sortCategoriesForPicker } from "@/lib/categories";
import { CategoryChips } from "@/components/category-chips";
import { Modal } from "@/components/modal";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface WeeklyPlanProps {
  plans: WeeklyPlan[];
  categories: Category[];
  onDelete: (id: number) => void;
  onCreate: (planDate: string, title: string, categoryId: number) => Promise<void>;
  onUpdate: (id: number, title: string, categoryId: number, planDate: string) => Promise<void>;
  onToggleCompleted: (id: number, completed: boolean) => Promise<void>;
}

export function WeeklyPlan({ plans, categories, onDelete, onCreate, onUpdate, onToggleCompleted }: WeeklyPlanProps) {
  const sortedCategories = sortCategoriesForPicker(categories);
  const firstCategoryId = sortedCategories[0]?.id ?? 0;
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WeeklyPlan | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState(0);

  const selectedCategoryId = newCategoryId || firstCategoryId;

  const today = todayIso();
  const weekStart = weekStartIso(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart, i);
    const dayPlans = plans.filter((p) => p.planDate === date);
    return { date, dayName: DAY_NAMES[i], plans: dayPlans, isToday: date === today };
  });

  async function handleCreate() {
    if (!newTitle.trim() || !selectedDay || !selectedCategoryId) return;
    setSaving(true);
    await onCreate(selectedDay, newTitle.trim(), selectedCategoryId);
    setNewTitle("");
    setShowForm(false);
    setSaving(false);
  }

  const [toggling, setToggling] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const currentCategory = editingPlan
    ? sortedCategories.find((c) => c.id === editCategoryId) || editingPlan.category
    : undefined;

  async function handleToggleComplete() {
    if (!editingPlan) return;
    const nextCompleted = !editingPlan.completedAt;
    setEditingPlan((prev) =>
      prev ? { ...prev, completedAt: nextCompleted ? new Date().toISOString() : null } : null
    );
    setToggling(true);
    try {
      await onToggleCompleted(editingPlan.id, nextCompleted);
    } catch {
      setEditingPlan((prev) =>
        prev ? { ...prev, completedAt: editingPlan.completedAt } : null
      );
    } finally {
      setToggling(false);
    }
  }

  async function handleSave() {
    if (!editingPlan || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await onUpdate(editingPlan.id, editTitle.trim(), editCategoryId, editingPlan.planDate);
      setEditingPlan(null);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">PLANO DA SEMANA</span>
        </div>
        <button onClick={() => { setShowForm((v) => !v); setSelectedDay(today); }} className="icon-button small">
          {showForm ? <X size={16} /> : <Plus size={18} />}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 space-y-2">
              <div className="flex gap-2">
                <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} className="auth-input flex-1 text-sm" placeholder="O que planejar..." />
                <button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="icon-button small">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {days.map((d) => (
                  <button key={d.date} onClick={() => setSelectedDay(d.date)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${selectedDay === d.date ? "bg-[var(--accent)] text-[var(--bg-primary)]" : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"}`}>{d.dayName}</button>
                ))}
              </div>
              <CategoryChips
                categories={sortedCategories}
                selectedId={selectedCategoryId}
                onSelect={setNewCategoryId}
                compact
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <div key={day.date} className={`rounded-xl p-2 min-h-[80px] border transition-colors ${day.isToday ? "border-[var(--accent)] bg-[var(--accent-bg)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]"}`}>
            <div className={`text-center text-[10px] font-medium mb-1.5 ${day.isToday ? "text-[var(--accent)]" : "text-[var(--text-faint)]"}`}>
              {day.dayName} <span className="block text-[9px]">{day.date.slice(8, 10)}</span>
            </div>
            <div className="space-y-1">
              {day.plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`group relative rounded-lg p-1.5 text-[9px] leading-tight cursor-pointer ${plan.completedAt ? "line-through opacity-50" : ""}`}
                  style={{ borderLeft: `2px solid ${plan.category.color}` }}
                  onClick={() => {
                    setEditingPlan(plan);
                    setEditTitle(plan.title);
                    setEditCategoryId(plan.categoryId);
                  }}
                  title={`${plan.title} · ${plan.category.name}`}
                >
                  <span className="text-[var(--text)] block truncate">{plan.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }}
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500/80 text-white"
                  >
                    <X size={8} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editingPlan && (
        <Modal onClose={() => setEditingPlan(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: currentCategory?.color || editingPlan.category.color,
                    boxShadow: `0 0 6px ${currentCategory?.color || editingPlan.category.color}40`,
                  }}
                />
                <span className="text-sm font-medium text-[var(--text)]">
                  {editingPlan.completedAt ? "Plano concluído" : "Detalhes do plano"}
                </span>
                {editingPlan.completedAt && (
                  <span className="rounded-full bg-[var(--green-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--green)]">
                    Concluído
                  </span>
                )}
              </div>
              <button onClick={() => setEditingPlan(null)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Título</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="auth-input w-full text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Categoria</label>
                <CategoryChips
                  categories={sortedCategories}
                  selectedId={editCategoryId}
                  onSelect={setEditCategoryId}
                  compact
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2 justify-end items-center">
              <button
                type="button"
                onClick={handleToggleComplete}
                disabled={toggling}
                className="mr-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                style={{
                  color: editingPlan.completedAt ? "#ffb86b" : "var(--green)",
                  background: editingPlan.completedAt ? "rgba(255,184,107,.1)" : "var(--green-bg)",
                }}
              >
                {toggling ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {editingPlan.completedAt ? "Reabrir" : "Concluir"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onDelete(editingPlan.id);
                  setEditingPlan(null);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={13} /> Excluir
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={savingEdit || !editTitle.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
