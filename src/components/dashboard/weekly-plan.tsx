"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { Calendar, Plus, Check, X, Loader2, Pencil, Trash2, Repeat } from "lucide-react";
import type { Category, WeeklyPlanItem } from "@/types";
import { weekStartIso, addDaysIso, todayIso } from "@/lib/db/dates";
import { Modal } from "@/components/modal";
import { IconButton } from "@/components/ui";
import { PlanModal, type CreateSeriesPayload } from "../weekly-plan/PlanModal";
import { WeeklyPlanInputCard, PLAN_NAME_MAX } from "./weekly-plan-input-card";

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
  onUpdateOccurrenceOverride?: (seriesId: number, date: string, title: string, startTime: string | null) => Promise<void>;
  onToggleOccurrence?: (seriesId: number, date: string, completed: boolean) => Promise<void>;
  onDeleteSeries?: (seriesId: number) => Promise<void>;
}

export function WeeklyPlan({
  plans, categories, onDelete, onCreate, onUpdate, onToggleCompleted,
  onCreateSeries, onUpdateSeries, onUpdateOccurrenceOverride, onToggleOccurrence, onDeleteSeries,
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
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addDaysIso(weekStartIso(today), weekOffset * 7);
  const visiblePlans = plans.map((plan) => {
    const key = `${plan.seriesId ?? "legacy"}:${plan.id}:${plan.planDate}`;
    return Object.prototype.hasOwnProperty.call(completionOverrides, key)
      ? { ...plan, completedAt: completionOverrides[key] }
      : plan;
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart, i);
    const dayPlans = visiblePlans.filter((p) => p.planDate === date);
    // Sort by start time: items with time first, then without time
    const sortedPlans = [...dayPlans].sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });
    return { date, dayName: DAY_NAMES[i], plans: sortedPlans, isToday: date === today };
  });

  async function handleCreate() {
    setModalPrefillDate(today);
    setShowModal(true);
  }

  async function handleCreateSeries(payload: CreateSeriesPayload) {
    if (onCreateSeries) {
      await onCreateSeries(payload);
    } else {
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
    <div className="panel weekly-plan-ambient relative overflow-hidden p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-[var(--accent)]" />
          <span className="eyebrow muted">PLANO DA SEMANA</span>
          <span className="text-sm text-[var(--text-muted)]">
            {weekStart.slice(8,10)}/{weekStart.slice(5,7)} – {addDaysIso(weekStart, 6).slice(8,10)}/{addDaysIso(weekStart, 6).slice(5,7)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeekOffset((v) => v - 1)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Semana anterior">
            ←
          </button>
          <button type="button" onClick={() => setWeekOffset(0)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Semana atual">
            Hoje
          </button>
          <button type="button" onClick={() => setWeekOffset((v) => v + 1)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Próxima semana">
            →
          </button>
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
      </div>

      {/* Week strip */}
      <div className="overflow-visible pb-1 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
          {days.map((day) => (
            <div
              key={day.date}
              ref={day.isToday ? todayCellRef : undefined}
              className={`weekly-plan-day relative flex min-h-[150px] min-w-0 rounded-[12px] p-3 transition-colors duration-150 ${
                day.isToday ? "weekly-plan-day--today" : ""
              }`}
              onClick={() => {
                if (day.plans.length === 0) {
                  setModalPrefillDate(day.date);
                  setShowModal(true);
                }
              }}
            >
              {/* Header */}
              <div className={`mb-2 flex items-center justify-between px-1 ${
                day.isToday ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}>
                <span className="text-[12px] font-semibold uppercase tracking-[.14em] opacity-80">{day.dayName}</span>
                <span className="font-mono text-[16px] leading-none tabular-nums">{day.date.slice(8, 10)}</span>
              </div>

              {/* Body */}
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin] min-w-0">
                {day.plans.length === 0 && (
                  <div className="flex h-full items-center justify-center text-center text-[12px] text-[var(--text-muted)] opacity-60">
                    Sem planos
                  </div>
                )}
                {day.plans.slice(0, MAX_ITEMS_PER_CARD).map((plan) => (
                  <PlanItemRow
                    key={plan.id}
                    plan={plan}
                    onEdit={() => { void openEdit(plan); }}
                    onToggle={() => { void handleToggleComplete(plan); }}
                  />
                ))}
                {day.plans.length > MAX_ITEMS_PER_CARD && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverDay({ date: day.date, items: day.plans });
                    }}
                    className="block w-full text-center text-[13px] font-medium rounded-md px-1.5 py-1 text-[var(--accent)] hover:bg-[var(--accent-bg)] transition-colors"
                  >
                    +{day.plans.length - MAX_ITEMS_PER_CARD} mais
                  </button>
                )}
              </div>

              {/* Footer - compact add button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalPrefillDate(day.date);
                  setShowModal(true);
                }}
                className="mt-1 flex items-center justify-center gap-1 w-full text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-bg)] rounded-md px-2 py-1 transition-colors"
                aria-label="Adicionar plano"
              >
                <Plus size={14} /> <span className="hidden sm:inline">Adicionar</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Day popover */}
      {popoverDay && (
        <div
          ref={popoverRef}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xl"
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
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <PlanModal
          categories={categories}
          prefillDate={modalPrefillDate}
          onClose={() => { setShowModal(false); requestAnimationFrame(() => createTriggerRef.current?.focus()); }}
          onSaveSeries={handleCreateSeries}
        />
      )}

      {/* Edit modal (legacy style, for one-time items) */}
      {editingPlan && (
        editingSeries && onUpdateSeries
          ? <PlanModal
              series={editingSeries}
              occurrence={editingPlan ?? undefined}
              categories={categories}
              defaultScope="occurrence"
              onClose={closeEditingPlan}
              onSaveSeries={handleUpdateSeries}
              onSaveOccurrence={async ({ title, startTime }) => {
                if (!editingPlan?.seriesId) return;
                await onUpdateOccurrenceOverride?.(editingPlan.seriesId, editingPlan.planDate, title, startTime);
                closeEditingPlan();
              }}
              onDelete={handleDeleteSeriesFromEditor}
            />
          : <Modal
              key={`edit-${editingPlan.id}`}
              onClose={() => { if (editIsDirty && !window.confirm("Descartar as alterações não salvas?")) return; closeEditingPlan(); }}
              title={
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: editingPlan.color || editingPlan.category.color }} />
                  Editar plano
                  {editingPlan.completedAt && (
                    <span className="rounded-full bg-[var(--green-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--green)]">Concluído</span>
                  )}
                </div>
              }
              description={editingPlan.isRecurring ? "Plano recorrente" : undefined}
              panelClassName="sm:max-w-xl"
              footerClassName="flex-nowrap"
              footer={
                <EditModalFooter
                  confirmDelete={confirmDelete}
                  setConfirmDelete={setConfirmDelete}
                  deleteTimer={deleteTimer}
                  setDeleteTimer={setDeleteTimer}
                  handleDelete={handleDelete}
                  editIsDirty={editIsDirty}
                  closeEditingPlan={closeEditingPlan}
                  savingEdit={savingEdit}
                  handleSave={handleSave}
                  editTitle={editTitle}
                  editingPlan={editingPlan}
                />
              }
            >
              <div className="w-full space-y-6 pb-3">
                <div className="space-y-4">
                  <WeeklyPlanInputCard
                    id="plan-name-edit-input"
                    value={editTitle}
                    onChange={setEditTitle}
                    color={editingPlan.color || editingPlan.category.color}
                    placeholder="Ex.: Ir à igreja, #trabalho, Treino..."
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSave(); } }}
                    aria-label="Nome ou tag do plano"
                  />
                  <div>
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">
                      Detalhes
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Para alterar recorrência, horário, duração, cor e nota, abra o plano pela opção de edição completa.
                    </p>
                  </div>
                </div>
              </div>
            </Modal>
      )}
    </div>
  );
}

// ── Helper component for the legacy edit modal footer ─────────────────────
function EditModalFooter({
  confirmDelete,
  setConfirmDelete,
  deleteTimer,
  setDeleteTimer,
  handleDelete,
  editIsDirty,
  closeEditingPlan,
  savingEdit,
  handleSave,
  editTitle,
  editingPlan,
}: {
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleteTimer: ReturnType<typeof setTimeout> | null;
  setDeleteTimer: (t: ReturnType<typeof setTimeout> | null) => void;
  handleDelete: () => void;
  editIsDirty: boolean;
  closeEditingPlan: () => void;
  savingEdit: boolean;
  handleSave: () => void;
  editTitle: string;
  editingPlan: WeeklyPlanItem;
}) {
  return (
    <>
      <div className="mr-auto flex shrink-0 items-center gap-1">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(true);
              if (deleteTimer) clearTimeout(deleteTimer);
              setDeleteTimer(setTimeout(() => setConfirmDelete(false), 3000));
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-300 hover:bg-red-400/10"
          >
            <Trash2 size={15} />
            Excluir
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="h-10 rounded-lg bg-red-500/20 px-3 text-sm font-semibold text-red-200"
            >
              Confirmar exclusão
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(false);
                if (deleteTimer) clearTimeout(deleteTimer);
              }}
              className="h-10 rounded-lg px-3 text-sm text-[var(--text-muted)]"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          if (!editIsDirty || window.confirm("Descartar as alterações não salvas?")) closeEditingPlan();
        }}
        className="h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)]"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={savingEdit || !editTitle.trim() || editTitle.trim() === editingPlan.title || editTitle.length > PLAN_NAME_MAX}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {savingEdit ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        Salvar
      </button>
    </>
  );
}

function PlanItemRow({ plan, onEdit, onToggle }: { plan: WeeklyPlanItem; onEdit: () => void; onToggle: () => void }) {
  const displayColor = plan.color || plan.category.color;
  const skipped = plan.skipped;
  const isCompleted = Boolean(plan.completedAt);

  return (
    <div
      data-plan-key={`${plan.seriesId ?? "legacy"}-${plan.id}-${plan.planDate}`}
      tabIndex={0}
      role="button"
      aria-label={isCompleted ? "Plano concluído" : "Plano pendente"}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdit(); } }}
      className="weekly-plan-item group relative flex min-h-[40px] w-full items-center justify-between gap-3 overflow-hidden rounded-lg border px-3 py-2 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
      style={
        {
          "--item-bg": isCompleted ? "rgba(154, 255, 184, 0.15)" : "rgba(255, 255, 255, 0.05)",
          "--item-border": isCompleted ? "rgba(154, 255, 184, 0.4)" : "rgba(255, 255, 255, 0.2)",
          "--text-opacity": isCompleted ? "0.55" : "1",
          backgroundColor: `var(--item-bg)`,
          borderLeft: `3px solid ${displayColor}`,
        } as CSSProperties
      }
      onClick={onEdit}
      title={`${plan.title}${plan.startTime ? " - " + plan.startTime : ""}`}
    >
      {/* Color bar is handled by border-left style */}
      <div className="flex min-w-0 flex-1">
        <div className="flex flex-col gap-0.5">
          <span
            className={`font-medium text-sm text-[var(--text)] line-clamp-2 ${
              isCompleted ? "line-through" : ""
            } ${skipped ? "italic opacity-60" : ""}`}
            style={{ opacity: skipped ? "0.6" : "var(--text-opacity)" } as CSSProperties}
          >
            {plan.title || "(sem título)"}
          </span>
          <div className="flex items-center gap-2">
            {plan.startTime && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {plan.startTime}
              </span>
            )}
            {plan.isRecurring && (
              <Repeat size={14} className="text-[var(--text-muted)] opacity-60" />
            )}
            {skipped && (
              <span className="text-xs rounded-full bg-[var(--text-muted)]/20 px-1.5 py-0.5 text-[var(--text-muted)]" aria-label="Pulado">
                Pulado
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Check button - always visible, 24px circle with 32px touch target */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-pressed={isCompleted}
        aria-label={isCompleted ? `Desmarcar plano "${plan.title}"` : `Concluir plano "${plan.title}"`}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150"
        style={
          {
            backgroundColor: isCompleted ? displayColor : "rgba(255, 255, 255, 0.05)",
            border: `2px solid ${isCompleted ? displayColor : "var(--text-muted)"}`,
            color: isCompleted ? "white" : "var(--text-muted)",
          } as CSSProperties
        }
      >
        {isCompleted ? (
          <Check size={16} strokeWidth={3} />
        ) : (
          <Check size={16} />
        )}
      </button>

      {/* Edit button - visible on focus/hover for desktop, always accessible on mobile */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        aria-label="Editar plano"
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden h-7 w-7 items-center justify-center rounded-md text-[var(--text-faint)] transition-all duration-150 hover:bg-white/[.08] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--accent)] group-hover:flex"
        title="Editar"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}
