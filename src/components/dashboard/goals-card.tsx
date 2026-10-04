"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  Check,
  Plus,
  Minus,
  Target,
  MoreVertical,
  Trash2,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Category, Goal } from "@/types";
import { categoryIcon, sortCategoriesForPicker } from "@/lib/categories";
import type { GoalLogAction } from "@/lib/db/goal-logs";
import {
  CreateGoalModal,
  EditGoalModal,
  type GoalDraft,
} from "./goals-modals";
import { diffDaysIso, todayIso } from "@/lib/db/dates";

function isComplete(goal: Goal): boolean {
  return goal.targetValue > 0 && goal.currentValue >= goal.targetValue;
}

/** "faltam 12 dias" | "hoje" | "amanhã" | "12 dias em atraso" | null (sem prazo). */
function deadlineLabel(goal: Goal, today: string): { text: string; overdue: boolean } | null {
  if (!goal.deadline) return null;
  const days = diffDaysIso(goal.deadline, today);
  if (isComplete(goal)) return { text: "concluída", overdue: false };
  if (days < 0) return { text: `${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"} em atraso`, overdue: true };
  if (days === 0) return { text: "vence hoje", overdue: false };
  if (days === 1) return { text: "vence amanhã", overdue: false };
  return { text: `faltam ${days} dias`, overdue: false };
}

/**
 * Ativas primeiro pelo prazo mais próximo (sem prazo vão para o fim), concluídas
 * num grupo colapsado no rodapé.
 */
function sortGoals(goals: Goal[]): { active: Goal[]; completed: Goal[] } {
  const active = goals.filter((g) => !isComplete(g));
  const completed = goals.filter(isComplete);
  const byDeadline = (a: Goal, b: Goal) => {
    if (!a.deadline && !b.deadline) return a.id - b.id;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : a.id - b.id;
  };
  active.sort(byDeadline);
  completed.sort((a, b) => (b.deadline ?? "").localeCompare(a.deadline ?? "") || a.id - b.id);
  return { active, completed };
}

export function GoalsCard({
  goals,
  onProgress,
  onDelete,
  onUpdate,
  onCreate,
  categories,
}: {
  goals: Goal[];
  /**
   * Aplica um check-in na meta (increment/decrement/toggle/uncheck). A fonte da
   * verdade é o servidor (POST /api/goal-logs): ele soma os logs do período e
   * concede/estorna XP e moedas na transição de conclusão.
   */
  onProgress: (goalId: number, action: GoalLogAction) => Promise<void> | void;
  onDelete?: (goalId: number) => Promise<void> | void;
  onUpdate?: (goalId: number, patch: GoalDraft, prev: Goal) => void;
  onCreate?: (goal: Goal) => void;
  categories?: Category[];
}) {
  const reduced = useReducedMotion();
  const [showCompleted, setShowCompleted] = useState(false);
  const { active: activeGoals, completed: completedGoals } = sortGoals(goals);

  // ids em celebração (acabaram de completar) — controla a animação de parabenização
  const [celebrating, setCelebrating] = useState<Set<number>>(new Set());
  // id da meta com menu kebab aberto
  const [activeMenuGoalId, setActiveMenuGoalId] = useState<number | null>(null);
  // posição (tela) do trigger do menu — colapsa quando o menu fecha
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  // id da meta em confirmação de exclusão
  const [confirmGoalId, setConfirmGoalId] = useState<number | null>(null);
  // id da meta sendo excluída (loading state)
  const [deletingGoalId, setDeletingGoalId] = useState<number | null>(null);
  // id da meta em edição (abre o modal)
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  // controla o modal de criação de nova meta
  const [showCreateModal, setShowCreateModal] = useState(false);

  // refs para os botões de trigger, para ancorar o popover no viewport
  const triggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Fecha menus/popovers ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (activeMenuGoalId === null && confirmGoalId === null) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-goal-menu]")) {
        setActiveMenuGoalId(null);
        setMenuAnchor(null);
        setConfirmGoalId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuGoalId(null);
        setMenuAnchor(null);
        setConfirmGoalId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuGoalId, confirmGoalId]);

  const celebrate = (goalId: number) => {
    setCelebrating((prev) => {
      const next = new Set(prev);
      next.add(goalId);
      return next;
    });
    window.setTimeout(() => {
      setCelebrating((prev) => {
        if (!prev.has(goalId)) return prev;
        const next = new Set(prev);
        next.delete(goalId);
        return next;
      });
    }, 1400);
  };

  const openMenu = (goalId: number) => {
    const el = triggerRefs.current.get(goalId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuAnchor({ top: rect.bottom + 6, left: rect.right });
    }
    setActiveMenuGoalId(goalId);
    setConfirmGoalId(null);
  };

  const closeMenu = () => {
    setActiveMenuGoalId(null);
    setMenuAnchor(null);
    setConfirmGoalId(null);
  };

  const handleDelete = async (goalId: number) => {
    if (!onDelete) return;
    setDeletingGoalId(goalId);
    try {
      await onDelete(goalId);
    } finally {
      setDeletingGoalId(null);
      setConfirmGoalId(null);
      setActiveMenuGoalId(null);
      setMenuAnchor(null);
    }
  };

  const openEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    closeMenu();
  };

  const editingGoal = goals.find((g) => g.id === editingGoalId) ?? null;
  const sortedCategories = sortCategoriesForPicker(categories ?? []);

  if (goals.length === 0) {
    return (
      <div className="panel p-6 h-full flex flex-col items-center justify-center">
        <motion.div
          animate={reduced ? {} : { y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Target size={24} className="text-[var(--text-faint)] mb-3" />
        </motion.div>
        <p className="text-sm text-[var(--text-muted)]">Nenhuma meta ativa</p>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="mt-2 text-xs text-[var(--accent)] hover:underline cursor-pointer"
        >
          Criar meta
        </button>
        <CreateGoalModal
          open={showCreateModal}
          categories={sortCategoriesForPicker(categories ?? [])}
          onClose={() => setShowCreateModal(false)}
          onCreated={(goal) => {
            onCreate?.(goal);
            setShowCreateModal(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="panel p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow muted">METAS ATIVAS</span>
        <span className="text-xs text-[var(--text-muted)]">{goals.length} meta{goals.length === 1 ? "" : "s"}</span>
      </div>

      <div className="relative grid grow grid-cols-1 sm:grid-cols-2 gap-3 content-start">
        <AnimatePresence mode="popLayout" initial={false}>
          {activeGoals.map((goal) => {
            const { color, icon } = goal.category;
            const Icon = categoryIcon(icon);
            const done = isComplete(goal);
            const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
            const deadline = deadlineLabel(goal, todayIso());
            const isCelebrating = celebrating.has(goal.id);
            const isMenuOpen = activeMenuGoalId === goal.id || confirmGoalId === goal.id;

            const handleProgress = (action: GoalLogAction) => {
              // Celebra só quando a ação prevista conclui a meta — o servidor
              // devolve o estado real logo em seguida (otimista vivo).
              const predictsCompletion =
                action === "set" ||
                (action === "increment" && goal.currentValue + 1 >= goal.targetValue);
              if (!done && predictsCompletion) celebrate(goal.id);
              void onProgress(goal.id, action);
            };

            return (
              <motion.div
                layout="position"
                key={goal.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.85,
                  transition: { duration: 0.2, ease: "easeOut" },
                }}
                transition={{
                  layout: { type: "spring", stiffness: 350, damping: 28 },
                  opacity: { duration: 0.2 },
                }}
                whileHover={reduced || isMenuOpen ? undefined : { y: -2 }}
                whileTap={reduced || isMenuOpen ? undefined : { scale: 0.97 }}
                className={`group relative flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 ${
                  isMenuOpen ? "overflow-visible z-20" : "overflow-hidden"
                }`}
                style={{
                  borderColor: done ? `${color}33` : "var(--border-subtle)",
                  background: done
                    ? "var(--bg-surface-hover)"
                    : `linear-gradient(135deg, ${color}0d, transparent 55%)`,
                }}
              >
                {/* Ação de menu/excluir meta (kebab menu) */}
                {onDelete && (
                  <div className="absolute top-1.5 right-1.5 z-20" data-goal-menu>
                    <button
                      ref={(el) => {
                        if (el) triggerRefs.current.set(goal.id, el);
                        else triggerRefs.current.delete(goal.id);
                      }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMenuOpen) {
                          closeMenu();
                        } else {
                          openMenu(goal.id);
                        }
                      }}
                      aria-label={`Opções da meta ${goal.title}`}
                      title="Opções"
                      className={`tap flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-faint)] transition-all hover:bg-[var(--bg-surface-active)] hover:text-[var(--text)] focus:opacity-100 cursor-pointer ${
                        isMenuOpen
                          ? "opacity-100 bg-[var(--bg-surface-active)] text-[var(--text)]"
                          : "opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-100"
                      }`}
                    >
                      <MoreVertical size={13} />
                    </button>
                  </div>
                )}

                {/* Ícone da categoria com tint/glow na cor da categoria */}
                <motion.div
                  animate={isCelebrating ? { scale: [1, 1.15, 1] } : undefined}
                  transition={{ duration: 0.5 }}
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `${color}1a`,
                    boxShadow: isCelebrating ? `0 0 14px ${color}80` : `0 0 0px transparent`,
                  }}
                >
                  <Icon size={18} style={{ color }} />
                </motion.div>

                <div className="min-w-0 flex-1 pr-6">
                  <p
                    className="line-clamp-2 text-xs font-medium leading-snug text-[var(--text)]"
                    title={goal.title}
                    style={done ? { textDecoration: "line-through", color: "var(--text-faint)" } : undefined}
                  >
                    {goal.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[10px] text-[var(--text-faint)]">
                      {done ? (
                        <span style={{ color }}>Concluída</span>
                      ) : (
                        <>
                          {Math.min(goal.currentValue, goal.targetValue)}/{goal.targetValue}
                          {goal.unit ? ` ${goal.unit}` : ""} · {pct}%
                        </>
                      )}
                    </p>
                    {deadline && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          deadline.overdue
                            ? "bg-red-500/15 text-red-400"
                            : "bg-[var(--bg-surface-active)] text-[var(--text-muted)]"
                        }`}
                      >
                        {deadline.text}
                      </span>
                    )}
                  </div>

                  {/* Barra de progresso com fill em spring */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-active)]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color, boxShadow: `0 0 6px ${color}66` }}
                      initial={false}
                      animate={{ width: `${done ? 100 : pct}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                  </div>
                </div>

                {/* Ação: −1/+1. Concluída (current >= target) o check vira botão
                    de DESMARCAR, e o servidor estorna a recompensa de 50/50. */}
                <div className="flex shrink-0 items-center gap-1">
                  {done ? (
                    <>
                      {goal.targetValue > 1 && (
                        <motion.button
                          whileTap={reduced ? undefined : { scale: 0.92 }}
                          onClick={() => handleProgress("decrement")}
                          aria-label={`Remover progresso de ${goal.title}`}
                          title="Remover −1"
                          className="tap flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                        >
                          <Minus size={16} strokeWidth={3} />
                        </motion.button>
                      )}
                      <motion.button
                        initial={{ scale: 0.4 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 14 }}
                        whileTap={reduced ? undefined : { scale: 0.92 }}
                        onClick={() => handleProgress("decrement")}
                        aria-label={`Desmarcar ${goal.title}`}
                        title="Desmarcar meta concluída"
                        className="tap flex h-8 w-8 items-center justify-center rounded-full cursor-pointer"
                        style={{ background: `${color}1a`, color }}
                      >
                        <Check size={16} strokeWidth={3} />
                      </motion.button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1">
                      {goal.targetValue > 1 && goal.currentValue > 0 && (
                        <motion.button
                          whileTap={reduced ? undefined : { scale: 0.92 }}
                          onClick={() => handleProgress("decrement")}
                          aria-label={`Remover progresso de ${goal.title}`}
                          title="Remover −1"
                          className="tap flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                        >
                          <Minus size={16} strokeWidth={3} />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={reduced ? undefined : { scale: 0.92 }}
                        onClick={() =>
                          handleProgress(
                            goal.currentValue + 1 >= goal.targetValue ? "set" : "increment",
                          )
                        }
                        aria-label={`Adicionar +1 a ${goal.title}`}
                        title="Adicionar +1"
                        className="tap flex h-8 w-8 items-center justify-center rounded-full border text-[var(--text)] transition-colors cursor-pointer"
                        style={{
                          borderColor: `${color}55`,
                          background: `${color}14`,
                          color,
                        }}
                      >
                        <Plus size={16} strokeWidth={3} />
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Explosão de celebração */}
                <AnimatePresence>
                  {isCelebrating && (
                    <motion.div
                      key="pop"
                      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.div
                        initial={{ scale: 0.3, rotate: -8 }}
                        animate={{ scale: [0.3, 1.5, 1], rotate: [0, 6, 0] }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 14 }}
                        style={{
                          background: color,
                          color: "var(--bg-primary)",
                          boxShadow: `0 0 24px ${color}`,
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                      >
                        <Check size={26} strokeWidth={3.5} />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Ghost placeholder — preenche espaço vazio e convida a criar uma nova meta */}
          <motion.div
              layout="position"
              key="ghost-placeholder"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                layout: { type: "spring", stiffness: 350, damping: 28 },
                opacity: { duration: 0.2 },
              }}
              className="h-full"
            >
              <motion.button
                type="button"
                onClick={() => setShowCreateModal(true)}
                whileHover={reduced ? undefined : { borderColor: "rgba(113,212,255,0.5)", color: "#71d4ff" }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                aria-label="Criar nova meta"
                className="group flex min-h-[72px] h-full w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 text-[var(--text-muted)] transition cursor-pointer"
              >
                <motion.span
                  whileHover={reduced ? undefined : { scale: 1.1, rotate: 90 }}
                  whileTap={reduced ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-current/30"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </motion.span>
                <span className="text-xs font-medium">Criar nova meta</span>
              </motion.button>
            </motion.div>
        </AnimatePresence>
      </div>

      {/* Metas concluídas: grupo colapsado no rodapé (current >= target) */}
      {completedGoals.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Concluídas ({completedGoals.length})
          </button>
          <AnimatePresence>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {completedGoals.map((goal) => {
                  const { color } = goal.category;
                  return (
                    <div
                      key={goal.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2 opacity-70"
                    >
                      <Check size={16} strokeWidth={3} style={{ color }} className="shrink-0" />
                      <span
                        className="line-clamp-1 min-w-0 flex-1 text-xs text-[var(--text-faint)] line-through"
                        title={goal.title}
                      >
                        {goal.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--text-faint)]">
                        {Math.min(goal.currentValue, goal.targetValue)}/{goal.targetValue}
                        {goal.unit ? ` ${goal.unit}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Menu dropdown portado (não fica preso ao overflow do card) ── */}
      {activeMenuGoalId !== null && menuAnchor && typeof document !== "undefined"
        ? createPortal(
            <DropdownPortal
              anchor={menuAnchor}
              hasEdit={!!onUpdate}
              deleting={deletingGoalId === activeMenuGoalId}
              reduced={!!reduced}
              onEdit={() => {
                const goal = goals.find((g) => g.id === activeMenuGoalId);
                if (goal) openEdit(goal);
              }}
              onDelete={() => setConfirmGoalId(activeMenuGoalId)}
              onConfirmDelete={() => void handleDelete(activeMenuGoalId)}
              onCancelDelete={() => setConfirmGoalId(null)}
              confirming={confirmGoalId === activeMenuGoalId}
            />,
            document.body,
          )
        : null}

      {/* ── Modal de edição (reuso do Modal compartilhado) ── */}
      {editingGoal && (
        <EditGoalModal
          key={editingGoal.id}
          goal={editingGoal}
          categories={sortedCategories}
          open={editingGoalId === editingGoal.id}
          onClose={() => setEditingGoalId(null)}
          onSave={(patch) => {
            if (!onUpdate) {
              setEditingGoalId(null);
              return;
            }
            onUpdate(editingGoal.id, patch, editingGoal);
            setEditingGoalId(null);
          }}
          onProgress={(action) => onProgress(editingGoal.id, action)}
          onDelete={onDelete ? async () => { await onDelete(editingGoal.id); } : undefined}
        />
      )}

      {/* ── Modal de criação de nova meta (premium) ── */}
      <CreateGoalModal
        open={showCreateModal}
        categories={sortedCategories}
        onClose={() => setShowCreateModal(false)}
        onCreated={(goal) => {
          onCreate?.(goal);
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dropdown portado (menu kebab ancorado no trigger, fora do card)     */
/* ------------------------------------------------------------------ */

const MENU_W = 178;

function DropdownPortal({
  anchor,
  hasEdit,
  deleting,
  reduced,
  confirming,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  anchor: { top: number; left: number };
  hasEdit: boolean;
  deleting: boolean;
  reduced: boolean;
  confirming: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  // Desloca o popover para não estourar a borda direita/inferior da viewport.
  const confirmW = 240;
  const w = confirming ? confirmW : MENU_W;
  const left = Math.max(8, Math.min(anchor.left - w + 4, window.innerWidth - w - 8));
  const top = Math.min(anchor.top, window.innerHeight - 48);

  const glowColor = "#71d4ff";

  return (
    <div
      data-goal-menu
      className="fixed z-[120]"
      style={{ top, left }}
    >
      <AnimatePresence>
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 30 }}
            className="relative w-60 rounded-xl border border-red-500/25 bg-white/[0.08] p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-xl"
              style={{
                background: "linear-gradient(180deg, rgba(239,68,68,0.35), transparent 45%)",
                opacity: 0.5,
              }}
            />
            <p className="relative text-xs font-semibold text-[var(--text)]">Excluir esta meta?</p>
            <p className="relative mt-0.5 text-[11px] text-[var(--text-faint)] leading-snug">
              Isso não pode ser desfeito.
            </p>
            <div className="relative mt-3 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={onCancelDelete}
                className="min-h-[44px] rounded-md px-3 text-xs font-medium text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <motion.button
                type="button"
                whileTap={reduced ? undefined : { scale: 0.94 }}
                disabled={deleting}
                onClick={onConfirmDelete}
                className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-red-500/20 border border-red-500/40 px-3 text-xs font-semibold text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Excluir
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.9, y: -6, originY: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 32 }}
            style={{ width: MENU_W, boxShadow: `0 10px 40px -10px rgba(0,0,0,0.8), 0 0 24px -6px ${glowColor}55` }}
            className="relative overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.08] p-1 backdrop-blur-xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(113,212,255,0.06), transparent 60%)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(113,212,255,0.7), transparent)",
                boxShadow: "0 0 8px rgba(113,212,255,0.4)",
              }}
            />

            {hasEdit && (
              <motion.button
                type="button"
                onClick={onEdit}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                className="relative flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[var(--text)] transition-colors hover:bg-white/[0.06] cursor-pointer"
              >
                <Pencil size={14} className="text-[#71d4ff]" />
                <span>Editar meta</span>
              </motion.button>
            )}

            <motion.button
              type="button"
              onClick={onDelete}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              className="relative flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Excluir meta</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
