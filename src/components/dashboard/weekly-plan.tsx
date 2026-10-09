"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Check, X, Loader2, Repeat, Pencil, SkipForward } from "lucide-react";
import type { Category, WeeklyPlanItem } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";
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
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalPrefillDate, setModalPrefillDate] = useState<string>(todayIso());
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  // Edit modal state
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Day popover state
  const [popoverDay, setPopoverDay] = useState<{ date: string; items: WeeklyPlanItem[] } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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
      await onUpdate(editingPlan.id, editTitle.trim(), editingPlan.categoryId, editingPlan.planDate);
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
          <Calendar size={18} className="text-[var(--accent)]" />
          <span className="eyebrow muted">PLANO DA SEMANA</span>
        </div>
        <motion.button
          ref={createTriggerRef}
          onClick={handleCreate}
          whileTap={{ scale: 0.92 }}
          className="icon-button small"
          title="Novo plano"
        >
          <Plus size={18} />
        </motion.button>
      </div>

      {/* Week strip */}
      <div
        ref={weekScrollerRef}
        className="-mx-5 overflow-x-auto px-5 pb-1 pt-1 scrollbar-hide sm:mx-0 sm:overflow-visible sm:px-0 sm:pt-0"
      >
        <div className="flex w-max gap-3 perspective-[1000px] sm:grid sm:w-auto sm:grid-cols-7">
          {days.map((day) => (
            <div
              key={day.date}
              ref={day.isToday ? todayCellRef : undefined}
              className={`group/day relative flex h-[190px] w-[156px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border p-2.5 transition-[transform,background,border-color] duration-200 hover:-translate-y-0.5 sm:w-auto ${
                day.isToday
                  ? "border-[var(--accent)] bg-[var(--accent-bg)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent),0_8px_22px_rgba(0,0,0,.24)]"
                  : "border-[var(--border-subtle)] bg-[linear-gradient(160deg,rgba(24,40,58,.94),rgba(13,25,39,.92))] shadow-[inset_0_1px_rgba(255,255,255,.035),0_8px_18px_rgba(0,0,0,.16)]"
              }`}
              onClick={() => {
                if (day.plans.length === 0) {
                  setModalPrefillDate(day.date);
                  setShowModal(true);
                }
              }}
            >
              <div className={`mb-2 flex items-end justify-between px-1 ${day.isToday ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                <span className="text-[10px] font-semibold uppercase tracking-[.14em]">{day.dayName}</span>
                <span className="font-mono text-lg leading-none tabular-nums">{day.date.slice(8, 10)}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
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
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); setPopoverDay({ date: day.date, items: day.plans }); }}
                    whileTap={{ scale: 0.95 }}
                    className="block w-full text-center text-[10px] font-medium rounded-md px-1.5 py-1 text-[var(--accent)] hover:bg-[var(--accent-bg)] transition-colors"
                  >
                    +{day.plans.length - MAX_ITEMS_PER_CARD} mais
                  </motion.button>
                )}
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); setModalPrefillDate(day.date); setShowModal(true); }} className="mt-1 flex h-7 shrink-0 items-center justify-center gap-1 rounded-md text-[11px] font-medium text-[var(--text-faint)] opacity-70 transition hover:bg-white/[.04] hover:text-[var(--accent)] hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                <Plus size={12} /> Adicionar
              </button>
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
          onClose={() => { setShowModal(false); requestAnimationFrame(() => createTriggerRef.current?.focus()); }}
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
                    background: editingPlan.color || editingPlan.category.color,
                    boxShadow: `0 0 6px ${editingPlan.color || editingPlan.category.color}40`,
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
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative flex min-h-9 items-center gap-2 overflow-hidden rounded-lg border border-white/[.07] bg-white/[.035] px-2 py-1.5 text-[11px] leading-tight cursor-pointer transition-[transform,background] hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-white/[.07] ${
        plan.completedAt ? "line-through opacity-40" : ""
      } ${plan.skipped ? "opacity-25" : ""}`}
      style={{ borderLeft: `3px solid ${displayColor}`, boxShadow: `inset 0 0 0 1px ${displayColor}18` }}
      onClick={onEdit}
      title={`${plan.title}${plan.startTime ? " · " + plan.startTime : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="block truncate font-medium text-[var(--text)]">{plan.title}</span>
        {plan.startTime && <span className="text-[9px] tabular-nums text-[var(--text-muted)]">{plan.startTime}</span>}
      </div>
      {plan.isRecurring && <Repeat size={12} className="shrink-0 text-[var(--text-faint)]" aria-label="Recorrente" />}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
          plan.completedAt ? "text-[var(--green)]" : "text-[var(--text-faint)] opacity-0 group-hover:opacity-100"
        }`}
        title={plan.completedAt ? "Reabrir" : "Concluir"}
      >
        <Check size={14} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] opacity-0 transition hover:bg-white/[.08] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        title="Editar"
      >
        <Pencil size={12} />
      </button>
    </motion.div>
  );
}
