"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Check,
  Plus,
  Target,
  MoreVertical,
  Trash2,
  Pencil,
  Loader2,
  X,
  Sparkles,
  Power,
} from "lucide-react";
import type { Category, Goal } from "@/types";
import type { HabitWithCompletion } from "@/lib/db";
import Link from "next/link";
import { categoryIcon, sortCategoriesForPicker } from "@/lib/categories";
import { CategoryChips } from "@/components/category-chips";
import { CategoryForm } from "@/components/category-form";
import { Modal } from "@/components/modal";
import { api } from "@/lib/api-client";

type GoalDraft = { title: string; categoryId: number; targetValue: number; frequency: Goal["frequency"] };
type HabitFrequency = "daily" | "weekly";
type HabitDraft = { title: string; frequency: HabitFrequency };

const FREQ_OPTIONS: { value: Goal["frequency"]; label: string }[] = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
];

function withAlpha(hex: string, alpha: number): string {
  const short = hex.replace("#", "");
  const full = short.length === 3 ? short.split("").map((c) => c + c).join("") : short;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Máximo de metas exibidas no card antes de delegar o restante ao link "Ver todas". */
const MAX_VISIBLE_GOALS = 12;

function isComplete(goal: Goal): boolean {
  return goal.targetValue > 0 && goal.currentValue >= goal.targetValue;
}

export function GoalsCard({
  goals,
  onAdjust,
  onDelete,
  onUpdate,
  onCreate,
  categories,
}: {
  goals: Goal[];
  onAdjust: (goalId: number, delta: number) => void;
  onDelete?: (goalId: number) => Promise<void> | void;
  onUpdate?: (goalId: number, patch: GoalDraft, prev: Goal) => void;
  onCreate?: (goal: Goal) => void;
  categories?: Category[];
}) {
  const reduced = useReducedMotion();
  const activeGoals = goals.slice(0, MAX_VISIBLE_GOALS);
  const overflowCount = goals.length - activeGoals.length;

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
        <div className="flex items-center gap-2">
          <Link
            href="/metas"
            aria-label="Ir para Metas e hábitos"
            title="Ir para Metas e hábitos"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          >
            <ArrowUpRight size={14} />
          </Link>
          <Link href="/metas" className="text-xs text-[var(--accent)] hover:underline">
            Ver todas{overflowCount > 0 ? ` (+${overflowCount})` : ""}
          </Link>
        </div>
      </div>

      <div className="relative grid grow grid-cols-1 sm:grid-cols-2 gap-3 content-start">
        <AnimatePresence mode="popLayout" initial={false}>
          {activeGoals.map((goal, i) => {
            const { color, icon, name: label } = goal.category;
            const Icon = categoryIcon(icon);
            const done = isComplete(goal);
            const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
            const isCelebrating = celebrating.has(goal.id);
            const isMenuOpen = activeMenuGoalId === goal.id || confirmGoalId === goal.id;

            const handleTap = () => {
              if (done) return;
              const next = goal.currentValue + 1;
              if (next >= goal.targetValue) celebrate(goal.id);
              onAdjust(goal.id, 1);
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
                    className="text-xs font-medium text-[var(--text)] truncate"
                    style={done ? { textDecoration: "line-through", color: "var(--text-faint)" } : undefined}
                  >
                    {goal.title}
                  </p>
                  <p className="text-[10px] text-[var(--text-faint)]">
                    {done ? (
                      <span style={{ color }}>Concluída</span>
                    ) : (
                      <>{label} · {goal.currentValue}/{goal.targetValue} · {pct}%</>
                    )}
                  </p>

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

                {/* Ação: check (meta unitária) ou +1 (meta quantitativa).
                    Botão visível compacto (32px), com padding invisível para
                    manter o alvo de toque acessível (~44px) no mobile. */}
                <div className="flex shrink-0 items-center">
                  {done ? (
                    <motion.div
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 14 }}
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: `${color}1a`, color }}
                    >
                      <Check size={16} strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-center p-1">
                      <motion.button
                        whileTap={reduced ? undefined : { scale: 0.92 }}
                        onClick={handleTap}
                        aria-label={goal.targetValue <= 1 ? `Concluir ${goal.title}` : `Adicionar progresso a ${goal.title}`}
                        title={goal.targetValue <= 1 ? "Marcar como concluída" : "Adicionar +1"}
                        className="tap flex h-8 w-8 items-center justify-center rounded-full border text-[var(--text)] transition-colors cursor-pointer"
                        style={{
                          borderColor: `${color}55`,
                          background: `${color}14`,
                          color,
                        }}
                      >
                        {goal.targetValue <= 1 ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
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
          {activeGoals.length < MAX_VISIBLE_GOALS && (
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
          )}
        </AnimatePresence>
      </div>

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
              onClose={closeMenu}
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
  onClose,
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
  onClose: () => void;
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

/* ------------------------------------------------------------------ */
/*  Modal de edição de meta (premium, cor-tie à categoria)             */
/* ------------------------------------------------------------------ */

function EditGoalModal({
  goal,
  categories,
  open,
  onClose,
  onSave,
}: {
  goal: Goal;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  onSave: (patch: GoalDraft) => void;
}) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState<GoalDraft>({
    title: goal.title,
    categoryId: goal.categoryId,
    targetValue: goal.targetValue,
    frequency: goal.frequency,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [error, setError] = useState("");

  useEffect(() => { setLocalCategories(categories); }, [categories]);

  useEffect(() => {
    if (!open) return;
    setDraft({
      title: goal.title,
      categoryId: goal.categoryId,
      targetValue: goal.targetValue,
      frequency: goal.frequency,
    });
    setShowCategoryForm(false);
    setSaving(false);
    setSaved(false);
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const category = localCategories.find((c) => c.id === draft.categoryId);
  const glowColor = category?.color ?? "#71d4ff";

  async function handleCategoryCreated(input: { name: string; color: string; icon: string | null }) {
    try {
      const { category: newCat } = await api.createCategory(input);
      setLocalCategories((prev) => [...prev, newCat]);
      setDraft((d) => ({ ...d, categoryId: newCat.id }));
      setShowCategoryForm(false);
    } catch {
      setError("Não foi possível criar a categoria.");
    }
  }

  const handleSave = () => {
    if (!draft.title.trim()) return;
    if (typeof onSave !== "function") {
      onClose();
      return;
    }
    setSaving(true);
    setSaved(true);
    window.setTimeout(() => {
      onSave({
        title: draft.title.trim(),
        categoryId: draft.categoryId,
        targetValue: Math.max(1, draft.targetValue || 1),
        frequency: draft.frequency,
      });
    }, 520);
  };

  return (
    <Modal open={open} onClose={onClose} panelClassName="max-w-md w-full">
      <motion.div
        style={{ perspective: 1000 }}
        initial={{ scale: reduced ? 1 : 0.92, rotateX: reduced ? 0 : -4, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, opacity: 1 }}
        exit={{ scale: 0.92, rotateX: reduced ? 0 : -4, opacity: 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 24 }}
      >
        <div
          className="glass-card relative w-full overflow-hidden p-6"
          style={{ border: `1px solid ${glowColor}30` }}
        >
        {/* brilho ambiente na cor da categoria */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-44 w-80 -translate-x-1/2 rounded-full opacity-40"
          style={{ background: `radial-gradient(ellipse, ${glowColor}55, transparent 70%)`, filter: "blur(22px)" }}
        />
        {/* partículas/faíscas ambientes (muito sutis) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {["12%", "78%", "85%", "20%"].map((left, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full"
              style={{ left, background: glowColor, opacity: 0.35, boxShadow: `0 0 6px ${glowColor}` }}
              animate={reduced ? undefined : { y: [0, -26, 0], opacity: [0, 0.6, 0] }}
              transition={{ duration: 6 + i, repeat: Infinity, delay: i * 1.2, ease: "easeInOut" }}
            />
          ))}
        </div>

        {/* borda LED superior sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${glowColor}99, transparent)`, boxShadow: `0 0 10px ${glowColor}66` }}
        />

        <div className="relative mb-5 flex items-center justify-between">
          <span className="eyebrow" style={{ color: glowColor }}>EDITAR META</span>
          <button onClick={onClose} className="icon-button small" aria-label="Fechar"><X size={14} /></button>
        </div>

        <div className="relative space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Título</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="auth-input"
              placeholder="Ex: Dormir 8 horas por dia"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Categoria</label>
            <CategoryChips
              categories={localCategories}
              selectedId={draft.categoryId}
              onSelect={(id) => setDraft((d) => ({ ...d, categoryId: id }))}
              onAdd={() => setShowCategoryForm((v) => !v)}
              addActive={showCategoryForm}
            />
            <AnimatePresence>
              {showCategoryForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4">
                    <CategoryForm
                      submitLabel="Criar categoria"
                      onSubmit={handleCategoryCreated}
                      onCancel={() => setShowCategoryForm(false)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Quantidade</label>
            <input
              type="number"
              min={1}
              value={draft.targetValue}
              onChange={(e) => setDraft((d) => ({ ...d, targetValue: Number(e.target.value) }))}
              className="auth-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Frequência</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQ_OPTIONS.map((opt) => {
                const selected = draft.frequency === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileTap={reduced ? undefined : { scale: 0.95 }}
                    onClick={() => setDraft((d) => ({ ...d, frequency: opt.value }))}
                    className="min-h-[40px] rounded-lg border text-xs font-medium transition-colors cursor-pointer"
                    style={
                      selected
                        ? { borderColor: glowColor, color: glowColor, background: withAlpha(glowColor, 0.12), boxShadow: `0 0 14px -4px ${glowColor}70` }
                        : { borderColor: "var(--border-subtle)", color: "var(--text-faint)", background: "var(--bg-tertiary)" }
                    }
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <motion.button
            whileTap={reduced ? undefined : { scale: 0.97 }}
            onClick={handleSave}
            disabled={!draft.title.trim() || saving}
            style={{
              background: glowColor,
              color: "var(--bg-primary)",
              boxShadow: `0 0 24px -8px ${glowColor}`,
            }}
            className="relative flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl text-xs font-bold transition-opacity disabled:opacity-40 cursor-pointer"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.3, 1], opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-1.5"
              >
                <Check size={15} strokeWidth={3} /> Salvo!
              </motion.span>
            ) : (
              <><Check size={15} strokeWidth={3} /> Salvar alterações</>
            )}
          </motion.button>
        </div>
      </div>
      </motion.div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal de criação de nova meta — premium 3D glass + LED + habits    */
/* ------------------------------------------------------------------ */

const HABIT_FREQ_OPTIONS: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
];

const PARTICLES = ["8%", "25%", "50%", "72%", "90%"];

function CreateGoalModal({
  open,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (goal: Goal) => void;
}) {
  const reduced = useReducedMotion();

  const defaultCategoryId = categories.find((c) => !c.userId && c.name === "Foco")?.id ?? categories[0]?.id ?? 0;

  const emptyDraft = (): GoalDraft => ({
    title: "",
    categoryId: defaultCategoryId,
    targetValue: 1,
    frequency: "daily",
  });

  const [draft, setDraft] = useState<GoalDraft>(emptyDraft);
  const [habitInput, setHabitInput] = useState("");
  const [habitFreq, setHabitFreq] = useState<HabitFrequency>("daily");
  const [pendingHabits, setPendingHabits] = useState<HabitDraft[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Sync categories from parent when they change
  useEffect(() => { setLocalCategories(categories); }, [categories]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setDraft({ ...emptyDraft(), categoryId: defaultCategoryId });
    setPendingHabits([]);
    setHabitInput("");
    setHabitFreq("daily");
    setShowCategoryForm(false);
    setSaving(false);
    setSaved(false);
    setError("");
    window.setTimeout(() => titleRef.current?.focus(), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const category = localCategories.find((c) => c.id === draft.categoryId);
  const glowColor = category?.color ?? "#71d4ff";

  function addPendingHabit() {
    if (!habitInput.trim()) return;
    setPendingHabits((prev) => [...prev, { title: habitInput.trim(), frequency: habitFreq }]);
    setHabitInput("");
  }

  function removePendingHabit(i: number) {
    setPendingHabits((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCategoryCreated(input: { name: string; color: string; icon: string | null }) {
    try {
      const { category: newCat } = await api.createCategory(input);
      setLocalCategories((prev) => [...prev, newCat]);
      setDraft((d) => ({ ...d, categoryId: newCat.id }));
      setShowCategoryForm(false);
    } catch {
      setError("Não foi possível criar a categoria.");
    }
  }

  async function handleSave() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { goal } = await api.createGoal({
        title: draft.title.trim(),
        categoryId: draft.categoryId || defaultCategoryId,
        targetValue: Math.max(1, draft.targetValue || 1),
        frequency: draft.frequency,
      });
      // Create pending habits sequentially
      for (const h of pendingHabits) {
        await api.createHabit(goal.id, h).catch(() => {});
      }
      setSaved(true);
      window.setTimeout(() => {
        onCreated(goal as Goal);
      }, 480);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a meta.");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} panelClassName="max-w-lg w-full">
      {/* Outer 3D wrapper — perspective tilt on mount */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, rotateX: 6, y: 24 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, rotateX: 6, y: 24 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        style={{ perspective: 1000, transformStyle: "preserve-3d" }}
        className="relative w-full"
      >
        {/* Glass card */}
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
            border: `1px solid ${glowColor}28`,
            boxShadow: `0 32px 80px -16px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 60px -20px ${glowColor}40`,
            backdropFilter: "blur(28px)",
          }}
        >
          {/* Ambient radial glow top-center */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full"
            style={{
              background: `radial-gradient(ellipse, ${glowColor}45, transparent 68%)`,
              filter: "blur(28px)",
            }}
          />

          {/* LED top border */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${glowColor}cc 40%, ${glowColor} 50%, ${glowColor}cc 60%, transparent 95%)`,
              boxShadow: `0 0 16px 2px ${glowColor}88`,
            }}
          />

          {/* LED bottom border (subtle) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${glowColor}33, transparent)`,
            }}
          />

          {/* Floating particles */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {PARTICLES.map((left, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  left,
                  bottom: "10%",
                  width: i % 2 === 0 ? 3 : 2,
                  height: i % 2 === 0 ? 3 : 2,
                  background: glowColor,
                  boxShadow: `0 0 8px 2px ${glowColor}`,
                  opacity: 0,
                }}
                animate={
                  reduced
                    ? undefined
                    : {
                        y: [0, -(80 + i * 20), 0],
                        opacity: [0, 0.7, 0],
                        x: [0, (i % 2 === 0 ? 1 : -1) * (6 + i * 2), 0],
                      }
                }
                transition={{
                  duration: 5 + i * 0.8,
                  repeat: Infinity,
                  delay: i * 0.9,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Inner glass sheen (top-left highlight) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -left-8 h-40 w-40 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)",
            }}
          />

          <div className="relative p-6 max-h-[88dvh] overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={reduced ? undefined : { rotate: [0, 15, -10, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${glowColor}30, ${glowColor}10)`,
                    border: `1px solid ${glowColor}40`,
                    boxShadow: `0 0 16px -4px ${glowColor}80`,
                  }}
                >
                  <Sparkles size={15} style={{ color: glowColor }} />
                </motion.div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: glowColor }}
                  >
                    Nova Meta
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)] leading-none mt-0.5">
                    Dashboard · Metas &amp; Hábitos
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={reduced ? undefined : { scale: 0.9 }}
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-white/[0.07] hover:text-[var(--text)] cursor-pointer"
              >
                <X size={15} />
              </motion.button>
            </div>

            <div className="space-y-5">
              {/* Título */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Título
                </label>
                <input
                  ref={titleRef}
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && void handleSave()}
                  className="auth-input"
                  placeholder="Ex: Dormir 8 horas por dia"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Categoria
                </label>
                <CategoryChips
                  categories={localCategories}
                  selectedId={draft.categoryId}
                  onSelect={(id) => setDraft((d) => ({ ...d, categoryId: id }))}
                  onAdd={() => setShowCategoryForm((v) => !v)}
                  addActive={showCategoryForm}
                />
                <AnimatePresence>
                  {showCategoryForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4">
                        <CategoryForm
                          submitLabel="Criar categoria"
                          onSubmit={handleCategoryCreated}
                          onCancel={() => setShowCategoryForm(false)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Quantidade + Frequência side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draft.targetValue}
                    onChange={(e) => setDraft((d) => ({ ...d, targetValue: Number(e.target.value) }))}
                    className="auth-input"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Frequência
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FREQ_OPTIONS.map((opt) => {
                      const selected = draft.frequency === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          type="button"
                          whileTap={reduced ? undefined : { scale: 0.93 }}
                          onClick={() => setDraft((d) => ({ ...d, frequency: opt.value }))}
                          className="min-h-[36px] rounded-lg border text-[10px] font-semibold transition-all cursor-pointer"
                          style={
                            selected
                              ? {
                                  borderColor: glowColor,
                                  color: glowColor,
                                  background: withAlpha(glowColor, 0.14),
                                  boxShadow: `0 0 16px -4px ${glowColor}80, inset 0 1px 0 ${glowColor}30`,
                                }
                              : {
                                  borderColor: "var(--border-subtle)",
                                  color: "var(--text-faint)",
                                  background: "rgba(255,255,255,0.03)",
                                }
                          }
                        >
                          {opt.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Hábitos */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Hábitos relacionados
                  <span className="ml-1.5 text-[var(--text-faint)] normal-case tracking-normal font-normal">
                    (opcional)
                  </span>
                </label>

                {/* Lista de hábitos pendentes */}
                <AnimatePresence initial={false}>
                  {pendingHabits.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: "auto" }}
                      exit={{ opacity: 0, x: 8, height: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="mb-1.5 flex items-center gap-2 overflow-hidden"
                    >
                      <div
                        className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2"
                        style={{
                          background: `${glowColor}0d`,
                          border: `1px solid ${glowColor}22`,
                        }}
                      >
                        <Power size={11} style={{ color: glowColor }} />
                        <span className="flex-1 text-xs text-[var(--text-secondary)]">{h.title}</span>
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: glowColor }}
                        >
                          {h.frequency === "daily" ? "Diário" : "Semanal"}
                        </span>
                      </div>
                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scale: 0.88 }}
                        onClick={() => removePendingHabit(i)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Input de novo hábito */}
                <div className="flex gap-2 mt-1">
                  <input
                    value={habitInput}
                    onChange={(e) => setHabitInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPendingHabit())}
                    className="auth-input flex-1 py-2! text-xs!"
                    placeholder="Adicionar hábito..."
                  />
                  <div className="flex shrink-0 gap-1">
                    {HABIT_FREQ_OPTIONS.map((o) => {
                      const sel = habitFreq === o.value;
                      return (
                        <motion.button
                          key={o.value}
                          type="button"
                          whileTap={reduced ? undefined : { scale: 0.93 }}
                          onClick={() => setHabitFreq(o.value)}
                          className="rounded-lg border px-2.5 py-2 text-[10px] font-semibold transition-all cursor-pointer"
                          style={
                            sel
                              ? { borderColor: glowColor, color: glowColor, background: withAlpha(glowColor, 0.14) }
                              : { borderColor: "var(--border-subtle)", color: "var(--text-faint)", background: "rgba(255,255,255,0.03)" }
                          }
                        >
                          {o.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-red-400"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* CTA */}
              <motion.button
                type="button"
                whileHover={
                  reduced
                    ? undefined
                    : { scale: 1.02, boxShadow: `0 0 40px -8px ${glowColor}` }
                }
                whileTap={reduced ? undefined : { scale: 0.97 }}
                onClick={handleSave}
                disabled={!draft.title.trim() || saving}
                className="relative flex w-full min-h-[48px] items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${glowColor}ee, ${glowColor}bb)`,
                  color: "var(--bg-primary)",
                  boxShadow: `0 0 28px -8px ${glowColor}cc, inset 0 1px 0 rgba(255,255,255,0.25)`,
                }}
              >
                {/* Sheen sweep on hover */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                  }}
                />
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : saved ? (
                  <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check size={16} strokeWidth={3} /> Meta criada!
                  </motion.span>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Criar meta
                    {pendingHabits.length > 0 && (
                      <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold">
                        +{pendingHabits.length} hábito{pendingHabits.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </Modal>
  );
}
