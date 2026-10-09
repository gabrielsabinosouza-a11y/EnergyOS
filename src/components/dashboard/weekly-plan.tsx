"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Check, X, Loader2, Repeat, Pencil, Trash2 } from "lucide-react";
import type { Category, WeeklyPlanItem } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";
import { Modal } from "@/components/modal";
import { Button, IconButton } from "@/components/ui";
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
  onUpdateSeries?: (seriesId: number, payload: CreateSeriesPayload) => Promise<void>;
  onToggleOccurrence?: (seriesId: number, date: string, completed: boolean) => Promise<void>;
  onSkipOccurrence?: (seriesId: number, date: string) => Promise<void>;
  onDeleteSeries?: (seriesId: number) => Promise<void>;
}

export function WeeklyPlan({
  plans, categories, onDelete, onCreate, onUpdate, onToggleCompleted,
  onCreateSeries, onUpdateSeries, onToggleOccurrence, onSkipOccurrence, onDeleteSeries,
}: WeeklyPlanProps) {
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalPrefillDate, setModalPrefillDate] = useState<string>(todayIso());
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  // Edit modal state
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanItem | null>(null);
  const [editingSeries, setEditingSeries] = useState<import("@/types").WeeklyPlanSeries | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [completionOverrides, setCompletionOverrides] = useState<Record<string, string | null>>({});
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const editIsDirty = Boolean(editingPlan && editTitle.trim() !== editingPlan.title);

  // Day popover state
  const [popoverDay, setPopoverDay] = useState<{ date: string; items: WeeklyPlanItem[] } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const today = todayIso();
  const weekStart = weekStartIso(today);
  const visiblePlans = plans.map((plan) => {
    const key = `${plan.seriesId ?? "legacy"}:${plan.id}:${plan.planDate}`;
    return Object.prototype.hasOwnProperty.call(completionOverrides, key)
      ? { ...plan, completedAt: completionOverrides[key] }
      : plan;
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart, i);
    const dayPlans = visiblePlans.filter((p) => p.planDate === date);
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

  async function openEdit(plan: WeeklyPlanItem) {
    setEditingPlan(plan);
    setEditTitle(plan.title);
    setConfirmDelete(false);
    if (plan.seriesId) {
      try {
        const { api } = await import("@/lib/api-client");
        const result = await api.getWeeklyPlanSeriesById(plan.seriesId);
        setEditingSeries(result.series);
      } catch {
        setEditingSeries(null);
      }
    } else setEditingSeries(null);
  }

  async function handleUpdateSeries(payload: CreateSeriesPayload) {
    if (!editingPlan?.seriesId || !onUpdateSeries) return;
    await onUpdateSeries(editingPlan.seriesId, payload);
    closeEditingPlan();
  }

  async function handleDeleteSeriesFromEditor() {
    if (!editingPlan?.seriesId || !onDeleteSeries) return;
    await onDeleteSeries(editingPlan.seriesId);
    closeEditingPlan();
  }

  function closeEditingPlan() {
    if (!editingPlan) return;
    const focusKey = `${editingPlan.seriesId ?? "legacy"}-${editingPlan.id}-${editingPlan.planDate}`;
    setEditingPlan(null);
    setEditingSeries(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-plan-key="${focusKey}"]`)?.focus());
  }

  async function handleToggleComplete(plan: WeeklyPlanItem) {
    const key = `${plan.seriesId ?? "legacy"}:${plan.id}:${plan.planDate}`;
    const oldValue = plan.completedAt ?? null;
    const nextCompleted = !oldValue;
    const newValue = nextCompleted ? new Date().toISOString() : null;
    setCompletionOverrides((current) => ({ ...current, [key]: newValue }));
    try {
      if (plan.seriesId && onToggleOccurrence) await onToggleOccurrence(plan.seriesId, plan.planDate, nextCompleted);
      else await onToggleCompleted(plan.id, nextCompleted);
    } catch {
      setCompletionOverrides((current) => ({ ...current, [key]: oldValue }));
    }
  }

  async function handleSave() {
    if (!editingPlan || !editTitle.trim() || !editIsDirty) return;
    setSavingEdit(true);
    try {
      await onUpdate(editingPlan.id, editTitle.trim(), editingPlan.categoryId, editingPlan.planDate);
      closeEditingPlan();
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

    if (editingPlan.seriesId && onDeleteSeries) await onDeleteSeries(editingPlan.seriesId);
    else await onDelete(editingPlan.id);
    closeEditingPlan();
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
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-[var(--accent)]" />
          <span className="eyebrow muted">PLANO DA SEMANA</span>
        </div>
        <IconButton
          ref={createTriggerRef}
          onClick={handleCreate}
          size="md"
          variant="secondary"
          title="Novo plano"
          aria-label="Novo plano"
        >
          <Plus size={18} />
        </IconButton>
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
              className={`weekly-plan-led ${day.isToday ? "weekly-plan-today" : ""} group/day relative flex h-[190px] w-[156px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border p-2.5 transition-[transform,background,border-color] duration-200 hover:-translate-y-0.5 sm:w-auto ${
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
                    onEdit={() => { void openEdit(plan); }}
                    onToggle={() => {
                      void handleToggleComplete(plan);
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
              <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setModalPrefillDate(day.date); setShowModal(true); }} className="mt-1 h-8 w-full shrink-0 font-medium text-[var(--text-faint)] hover:text-[var(--accent)]">
                <Plus size={14} /> Adicionar
              </Button>
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
                    void openEdit(plan);
                  }}
                  onToggle={() => {
                    setPopoverDay(null);
                    void handleToggleComplete(plan);
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
        editingSeries && onUpdateSeries ? <WeeklyPlanModal series={editingSeries} categories={categories} onClose={closeEditingPlan} onSave={handleUpdateSeries} onDelete={handleDeleteSeriesFromEditor} /> :
        <Modal
          onClose={() => { if (editIsDirty && !window.confirm("Descartar as alterações não salvas?")) return; closeEditingPlan(); }}
          title={<div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: editingPlan.color || editingPlan.category.color }} />Editar plano{editingPlan.completedAt && <span className="rounded-full bg-[var(--green-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--green)]">Concluído</span>}</div>}
          description={editingPlan.isRecurring ? "Plano recorrente" : undefined}
          panelClassName="sm:max-w-xl"
          footerClassName="flex-nowrap"
          footer={<>
            <div className="mr-auto flex shrink-0 items-center gap-1">
              {!confirmDelete ? <button type="button" onClick={() => { setConfirmDelete(true); if (deleteTimer) clearTimeout(deleteTimer); setDeleteTimer(setTimeout(() => setConfirmDelete(false), 3000)); }} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-300 hover:bg-red-400/10"><Trash2 size={15}/>Excluir</button> : <><button type="button" onClick={() => void handleDelete()} className="h-10 rounded-lg bg-red-500/20 px-3 text-sm font-semibold text-red-200">Confirmar exclusão</button><button type="button" onClick={() => { setConfirmDelete(false); if (deleteTimer) clearTimeout(deleteTimer); }} className="h-10 rounded-lg px-3 text-sm text-[var(--text-muted)]">Cancelar</button></>}
            </div>
            <button type="button" onClick={() => { if (!editIsDirty || window.confirm("Descartar as alterações não salvas?")) closeEditingPlan(); }} className="h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)]">Cancelar</button>
            <button type="button" onClick={() => void handleSave()} disabled={savingEdit || !editTitle.trim() || editTitle.trim() === editingPlan.title} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:opacity-50">{savingEdit ? <Loader2 size={15} className="animate-spin"/> : <Check size={15}/>}Salvar</button>
          </>}
        >
          <div className="w-full space-y-6 pb-3">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Nome da atividade</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={60}
                  className="auth-input min-h-10 w-full text-sm"
                />
                <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{editTitle.length}/60</span>
              </div>
              <div><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Detalhes</span><p className="text-xs text-[var(--text-muted)]">Para alterar recorrência, horário, duração, cor e nota, abra o plano pela opção de edição completa.</p></div>
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
      data-plan-key={`${plan.seriesId ?? "legacy"}-${plan.id}-${plan.planDate}`}
      tabIndex={0}
      role="button"
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdit(); } }}
      className={`weekly-plan-led group relative flex min-h-11 items-center gap-2 overflow-hidden rounded-lg border border-white/[.07] bg-white/[.035] px-2 py-1.5 text-[11px] leading-tight cursor-pointer transition-[transform,background] hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-white/[.07] ${
        plan.completedAt ? "opacity-45" : ""
      } ${plan.skipped ? "opacity-25" : ""}`}
      style={{ borderLeft: `3px solid ${displayColor}`, boxShadow: `inset 0 0 0 1px ${displayColor}18`, "--plan-led-color": plan.completedAt ? "#6bffb8" : displayColor } as CSSProperties}
      onClick={onEdit}
      title={`${plan.title}${plan.startTime ? " · " + plan.startTime : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`line-clamp-2 font-medium text-[var(--text)] ${plan.completedAt ? "line-through" : ""}`}>{plan.title}</span>
        {plan.startTime && <span className="text-[9px] tabular-nums text-[var(--text-muted)]">{plan.startTime}</span>}
      </div>
      {plan.isRecurring && <Repeat size={12} className="shrink-0 text-[var(--text-faint)]" aria-label="Recorrente" />}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-pressed={Boolean(plan.completedAt)}
        aria-label={plan.completedAt ? "Marcar como não concluída" : "Concluir tarefa"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 ${plan.completedAt ? "text-[var(--green)] opacity-100" : "text-[var(--text-faint)]"}`}
        title={plan.completedAt ? "Marcar como não concluída" : "Concluir tarefa"}
      >
        <Check size={15} strokeWidth={plan.completedAt ? 3 : 2} className={plan.completedAt ? "text-[var(--green)]" : ""} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        aria-label="Editar plano"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] [@media(hover:hover)]:opacity-0 transition hover:bg-white/[.08] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        title="Editar"
      >
        <Pencil size={12} />
      </button>
    </motion.div>
  );
}
