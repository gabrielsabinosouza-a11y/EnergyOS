"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Check, X, Loader2, Repeat, Pencil, SkipForward } from "lucide-react";
import type { Category, WeeklyPlanItem } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";
import { sortCategoriesForPicker } from "@/lib/categories";
import { CategoryChips } from "@/components/category-chips";
import { Modal } from "@/components/modal";
import { WeeklyPlanModal, type CreateSeriesPayload } from "./weekly-plan-modal";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_ITEMS_PER_CARD = 4;

interface WeeklyPlanProps {
  plans: WeeklyPlanItem[];
  categories: Category[];
  onDelete: (id: number) => void;
  onCreate: (planDate: string, title: string, categoryId: number) => Promise<void>;
  onUpdate: (id: number, title: string, categoryId: number, planDate: string) => Promise<void>;
  onToggleCompleted: (id: number, completed: boolean) => Promise<void>;
  onCreateSeries?: (payload: CreateSeriesPayload) => Promise<void>;
  onToggleOccurrence?: (seriesId: number, date: string, completed: boolean) => Promise<void>;
  onSkipOccurrence?: (seriesId: number, date: string) => Promise<void>;
  onDeleteSeries?: (seriesId: number) => Promise<void>;
}

export function WeeklyPlan({
  plans, categories, onDelete, onCreate, onUpdate, onToggleCompleted,
  onCreateSeries, onToggleOccurrence, onSkipOccurrence, onDeleteSeries,
}: WeeklyPlanProps) {
  const sortedCategories = sortCategoriesForPicker(categories);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalPrefillDate, setModalPrefillDate] = useState<string>(todayIso());

  // Edit modal state
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Day popover state
  const [popoverDay, setPopoverDay] = useState<{ date: string; items: WeeklyPlanItem[] } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentCategory = editingPlan
    ? sortedCategories.find((c) => c.id === editCategoryId) || editingPlan.category
    : undefined;

  const today = todayIso();
  const weekStart = weekStartIso(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart, i);
    const dayPlans = plans.filter((p) => p.planDate === date);
    return { date, dayName: DAY_NAMES[i], plans: dayPlans, isToday: date === today };
  });

  async function handleCreate() {
    setModalPrefillDate(today);
    setShowModal(true);
  }

  async function handleCreateSeries(payload: CreateSeriesPayload) {
    if (onCreateSeries) {
      await onCreateSeries(payload);
    } else {
      // Fallback: create a one-time legacy plan
      await onCreate(payload.startDate, payload.title, payload.categoryId);
    }
    setShowModal(false);
  }

  async function handleToggleComplete() {
    if (!editingPlan) return;
    const nextCompleted = !editingPlan.completedAt;

    // For recurring items, use the occurrence API
    if (editingPlan.seriesId && onToggleOccurrence) {
      setToggling(true);
      try {
        await onToggleOccurrence(editingPlan.seriesId, editingPlan.planDate, nextCompleted);
        setEditingPlan((prev) =>
          prev ? { ...prev, completedAt: nextCompleted ? new Date().toISOString() : null } : null
        );
      } catch {
        // rollback handled by parent re-fetch
      } finally {
        setToggling(false);
      }
      return;
    }

    // Legacy: use the old API
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

  async function handleDelete() {
    if (!editingPlan) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    // For recurring items, delete the series
    if (editingPlan.seriesId && onDeleteSeries) {
      await onDeleteSeries(editingPlan.seriesId);
    } else {
      await onDelete(editingPlan.id);
    }
    setEditingPlan(null);
  }

  async function handleSkip() {
    if (!editingPlan || !editingPlan.seriesId || !onSkipOccurrence) return;
    await onSkipOccurrence(editingPlan.seriesId, editingPlan.planDate);
    setEditingPlan(null);
  }

  // Mobile: the 7-day strip becomes a horizontal snap scroller
  const weekScrollerRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = weekScrollerRef.current;
    const cell = todayCellRef.current;
    if (!scroller || !cell) return;
    scroller.scrollTo({
      left: Math.max(0, cell.offsetLeft - (scroller.clientWidth - cell.offsetWidth) / 2),
    });
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverDay) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverDay(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverDay]);

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">PLANO DA SEMANA</span>
        </div>
        <button onClick={handleCreate} className="icon-button small" title="Novo plano">
          <Plus size={18} />
        </button>
      </div>

      {/* Week strip */}
      <div
        ref={weekScrollerRef}
        className="-mx-5 overflow-x-auto px-5 pb-1 pt-1 scrollbar-hide sm:mx-0 sm:overflow-visible sm:px-0 sm:pt-0"
      >
        <div className="flex w-max gap-1.5 sm:grid sm:w-auto sm:grid-cols-7">
          {days.map((day) => (
            <div
              key={day.date}
              ref={day.isToday ? todayCellRef : undefined}
              className={`w-[124px] shrink-0 snap-start rounded-xl p-2 min-h-[88px] border transition-colors sm:w-auto sm:min-h-[80px] ${
                day.isToday
                  ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]"
              }`}
              onClick={() => {
                if (day.plans.length === 0) {
                  setModalPrefillDate(day.date);
                  setShowModal(true);
                }
              }}
            >
              <div className={`text-center text-[10px] font-medium mb-1.5 ${day.isToday ? "text-[var(--accent)]" : "text-[var(--text-faint)]"}`}>
                {day.dayName} <span className="block text-[9px]">{day.date.slice(8, 10)}</span>
              </div>

              {day.plans.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <span className="text-[10px] text-[var(--text-faint)]">Nada planejado</span>
                </div>
              )}

              <div className="space-y-1">
                {day.plans.slice(0, MAX_ITEMS_PER_CARD).map((plan) => (
                  <PlanItemRow
                    key={plan.id}
                    plan={plan}
                    onEdit={() => {
                      setEditingPlan(plan);
                      setEditTitle(plan.title);
                      setEditCategoryId(plan.categoryId);
                      setConfirmDelete(false);
                    }}
                    onToggle={() => {
                      setEditingPlan(plan);
                      void handleToggleComplete();
                    }}
                  />
                ))}
                {day.plans.length > MAX_ITEMS_PER_CARD && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPopoverDay({ date: day.date, items: day.plans }); }}
                    className="block w-full text-center text-[10px] font-medium text-[var(--accent)] hover:underline"
                  >
                    +{day.plans.length - MAX_ITEMS_PER_CARD} mais
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day popover */}
      <AnimatePresence>
        {popoverDay && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text)]">
                {popoverDay.date.slice(8)}/{popoverDay.date.slice(5, 7)} — {popoverDay.items.length} itens
              </span>
              <button onClick={() => setPopoverDay(null)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {popoverDay.items.map((plan) => (
                <PlanItemRow
                  key={plan.id}
                  plan={plan}
                  onEdit={() => {
                    setPopoverDay(null);
                    setEditingPlan(plan);
                    setEditTitle(plan.title);
                    setEditCategoryId(plan.categoryId);
                    setConfirmDelete(false);
                  }}
                  onToggle={() => {
                    setPopoverDay(null);
                    setEditingPlan(plan);
                    void handleToggleComplete();
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit modal */}
      {showModal && (
        <WeeklyPlanModal
          categories={categories}
          prefillDate={modalPrefillDate}
          onClose={() => setShowModal(false)}
          onSave={handleCreateSeries}
        />
      )}

      {/* Edit modal (legacy style, for one-time items) */}
      {editingPlan && (
        <Modal onClose={() => setEditingPlan(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: editingPlan.color || currentCategory?.color || editingPlan.category.color,
                    boxShadow: `0 0 6px ${editingPlan.color || currentCategory?.color || editingPlan.category.color}40`,
                  }}
                />
                <span className="text-sm font-medium text-[var(--text)]">
                  {editingPlan.completedAt ? "Plano concluído" : "Editar plano"}
                </span>
                {editingPlan.completedAt && (
                  <span className="rounded-full bg-[var(--green-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--green)]">
                    Concluído
                  </span>
                )}
                {editingPlan.isRecurring && (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                    <Repeat size={10} /> Recorrente
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

            <div className="mt-6 flex gap-2 justify-end items-center flex-wrap">
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

              {editingPlan.isRecurring && onSkipOccurrence && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <SkipForward size={13} /> Pular esta vez
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  confirmDelete
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    : "text-red-400 hover:bg-red-400/10"
                }`}
              >
                <X size={13} /> {confirmDelete ? "Confirmar exclusão?" : "Excluir"}
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

function PlanItemRow({ plan, onEdit, onToggle }: { plan: WeeklyPlanItem; onEdit: () => void; onToggle: () => void }) {
  const displayColor = plan.color || plan.category.color;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`group flex items-center gap-1.5 rounded-lg p-1.5 text-[10px] leading-tight cursor-pointer ${
        plan.completedAt ? "line-through opacity-50" : ""
      } ${plan.skipped ? "opacity-30" : ""}`}
      style={{ borderLeft: `2px solid ${displayColor}` }}
      onClick={onEdit}
      title={`${plan.title}${plan.startTime ? " · " + plan.startTime : ""}`}
    >
      {plan.isRecurring && <Repeat size={10} className="shrink-0 text-[var(--text-faint)]" />}
      {plan.startTime && <span className="shrink-0 text-[var(--text-faint)]">{plan.startTime}</span>}
      <span className="text-[var(--text)] block truncate flex-1">{plan.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`shrink-0 rounded p-0.5 transition ${
          plan.completedAt ? "text-[var(--green)]" : "text-[var(--text-faint)] opacity-0 group-hover:opacity-100"
        }`}
        title={plan.completedAt ? "Reabrir" : "Concluir"}
      >
        <Check size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="shrink-0 rounded p-0.5 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition"
        title="Editar"
      >
        <Pencil size={12} />
      </button>
    </motion.div>
  );
}
