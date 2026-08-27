"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Check, X, Loader2 } from "lucide-react";
import type { Category, WeeklyPlan } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";
import { sortCategoriesForPicker } from "@/lib/categories";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface WeeklyPlanProps {
  plans: WeeklyPlan[];
  categories: Category[];
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: (planDate: string, title: string, categoryId: number) => Promise<void>;
}

export function WeeklyPlan({ plans, categories, onComplete, onDelete, onCreate }: WeeklyPlanProps) {
  const sortedCategories = sortCategoriesForPicker(categories);
  const firstCategoryId = sortedCategories[0]?.id ?? 0;
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(0);
  const [saving, setSaving] = useState(false);

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
              <div className="flex gap-1 flex-wrap">
                {sortedCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setNewCategoryId(cat.id)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] border transition-all ${
                      selectedCategoryId === cat.id ? "" : "border-[var(--border-subtle)] text-[var(--text-faint)]"
                    }`}
                    style={selectedCategoryId === cat.id ? { color: cat.color, borderColor: cat.color } : {}}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                    {cat.name}
                  </button>
                ))}
              </div>
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
                  onClick={() => !plan.completedAt && onComplete(plan.id)}
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
    </div>
  );
}
