"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Check,
  Plus,
  Minus,
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
import { todayIso } from "@/lib/db/dates";
import { useCardTilt, spring, ease, duration } from "@/lib/motion";

function isComplete(goal: Goal): boolean {
  return goal.targetValue > 0 && goal.currentValue >= goal.targetValue;
}

/** "faltam 12 dias" | "hoje" | "amanhã" | "12 dias em atraso" | null (sem prazo). */
function deadlineLabel(goal: Goal, today: string): { text: string; overdue: boolean } | null {
  if (!goal.deadline) return null;
  const diff = new Date(goal.deadline).getTime() - new Date(today).getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
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

/* ============================================================================
   GoalCardItem — um único card de meta, memoizado.
   Estrutura:
     - wrapper (motion, layout="position"): reposiciona na grade sem transform
       de hover, evitando conflito com o tilt.
     - surface (motion, tilt): rotaciona/eleva seguindo o ponteiro; overflow-hidden
       para o visual arredondado.
   Zonas: (a) área principal, (b) cluster de ação (−/+), (c) botão "⋮" separado.
   Sem overlay de hover sobre as ações.
   ============================================================================ */

interface GoalCardItemProps {
  goal: Goal;
  color: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  layoutId: string | number;
  done: boolean;
  pct: number;
  deadline: { text: string; overdue: boolean } | null;
  onProgress: (goalId: number, action: GoalLogAction) => void;
  onMenu?: (goalId: number) => void;
  onCloseMenu?: () => void;
  celebrating: boolean;
  flipping: boolean;
  reduced: boolean;
}

const GoalCardItem = memo(function GoalCardItem({
  goal,
  color,
  Icon: IconComp,
  layoutId,
  done,
  pct,
  deadline,
  onProgress,
  onMenu,
  onCloseMenu,
  celebrating,
  flipping,
  reduced,
}: GoalCardItemProps) {
  const { id, title, targetValue, currentValue, unit } = goal;
  const isSingle = targetValue <= 1;

  const [chipKey, setChipKey] = useState(0);
  const [shimmerKey, setShimmerKey] = useState(0);
  const pctRef = useRef(pct);

  const displayValue = useMotionValue(currentValue);
  const animatedValue = useSpring(displayValue, { stiffness: 300, damping: 24 });

  const tilt = useCardTilt({ enabled: !reduced });
  const highlightOpacity = useTransform(tilt.lift, [-2, 0], [1, 0]);

  useEffect(() => {
    displayValue.set(currentValue);
  }, [currentValue, displayValue]);

  useEffect(() => {
    if (pct > pctRef.current) setShimmerKey((k) => k + 1);
    pctRef.current = pct;
  }, [pct]);

  const handleProgress = useCallback(
    (action: GoalLogAction) => {
      onProgress(id, action);
      if (action === "increment" || action === "set") {
        setChipKey((k) => k + 1);
      }
    },
    [id, onProgress],
  );

  // Press-and-hold no +: repete o incremento após ~400 ms, acelerando.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdCount = useRef(0);

  const startHold = useCallback(() => {
    if (isSingle || done) return;
    holdCount.current = 0;
    holdTimer.current = setTimeout(() => {
      holdCount.current += 1;
      const gap = Math.max(80, 400 - holdCount.current * 40);
      handleProgress("increment");
      holdInterval.current = setInterval(() => {
        holdCount.current += 1;
        handleProgress("increment");
      }, gap);
    }, 400);
  }, [isSingle, done, handleProgress]);

  const stopHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdTimer.current = null;
    holdInterval.current = null;
    holdCount.current = 0;
  }, []);

  const buttonAria = useCallback(() => {
    if (isSingle) return done ? "Desconcluir meta" : "Concluir meta";
    if (done) return "Desconcluir meta";
    return "Adicionar 1";
  }, [isSingle, done]);

  const buttonTitle = useCallback(() => {
    if (isSingle) return done ? "Desconcluir meta" : "Concluir meta";
    if (done) return "Desconcluir meta concluída";
    return "Adicionar +1";
  }, [isSingle, done]);

  const ariaDecrement = `Remover 1 do progresso de ${title}`;
  const ariaIncrement = `Adicionar 1 ao progresso de ${title}`;

  const decrementDisabled = currentValue <= 0;

  const rolledCurrent = Math.round(animatedValue.get());

  return (
    {/* Wrapper: posicionamento na grade (layout). Sem estilo de transform próprio. */}
    <motion.div
      layout="position"
      layoutId={layoutId}
      key={goal.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.9,
        ...(flipping ? { rotateY: 180 } : {}),
        transition: { duration: duration.exit, ease: "easeOut" },
      }}
      transition={{
        layout: { type: "spring", ...spring.snappy },
        opacity: { duration: 0.2 },
      }}
      className="group relative flex"
    >
      {/* Surface com tilt 3D e brilho que seguem o ponteiro. */}
      <motion.div
        ref={tilt.ref}
        {...tilt.events}
        className="relative flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3"
        style={{
          ...tilt.style,
          borderColor: done ? `${color}33` : "var(--border-subtle)",
          background: done
            ? "var(--bg-surface-hover)"
            : `linear-gradient(135deg, ${color}0d, transparent 55%)`,
        }}
      >
        {/* Camada decorativa: brilho especular que segue o cursor (sem pointer). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden"
          style={{
            maskImage:
              "radial-gradient(circle at var(--hx, 50%) var(--hy, 50%), rgba(255,255,255,0.35) 0%, transparent 55%)",
            WebkitMaskImage:
              "radial-gradient(circle at var(--hx, 50%) var(--hy, 50%), rgba(255,255,255,0.35) 0%, transparent 55%)",
          }}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-px bg-gradient-to-tr from-transparent via-white/20 to-transparent"
            style={{
              x: tilt.highlightX,
              y: tilt.highlightY,
              rotate: 45,
              opacity: highlightOpacity,
            }}
          />
        </div>

        {/* ── Zona (a): ícone da categoria ── */}
        <motion.div
          animate={celebrating ? { scale: [1, 1.12, 1] } : undefined}
          transition={{ duration: 0.5 }}
          className="relative flex shrink-0 h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: `${color}1a`,
            boxShadow: celebrating ? `0 0 14px ${color}80` : `0 0 0 transparent`,
          }}
        >
          <IconComp size={18} style={{ color }} />
          {celebrating && (
            <svg
              className="absolute inset-0 rounded-full"
              style={{ width: 40, height: 40 }}
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                style={{
                  strokeDasharray: 62,
                  strokeDashoffset: celebrating ? 0 : 62,
                  transition: "stroke-dashoffset 0.5s ease",
                }}
              />
            </svg>
          )}
        </motion.div>

        <div className="min-w-0 flex-1 pr-6">
          <p
            className="line-clamp-1 text-xs font-medium leading-tight text-[var(--text)]"
            title={title}
            style={done ? { textDecoration: "line-through", color: "var(--text-faint)" } : undefined}
          >
            {title}
          </p>

          <div className="mt-1 flex items-center gap-2 min-w-0">
            <p className="text-[10px] text-[var(--text-faint)] whitespace-nowrap">
              {done ? (
                <span style={{ color }}>Concluída</span>
              ) : (
                <>
                  {Math.min(rolledCurrent, targetValue)}/{targetValue}
                  {unit ? ` ${unit}` : ""} · {pct}%
                </>
              )}
            </p>
            {deadline && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${
                  deadline.overdue
                    ? "bg-red-500/15 text-red-400"
                    : "bg-[var(--bg-surface-active)] text-[var(--text-muted)]"
                }`}
              >
                {deadline.text}
              </span>
            )}
          </div>

          {/* Barra de progresso: largura com spring + shimmer ao aumentar. */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-active)]">
            <motion.div
              className="relative h-full rounded-full overflow-hidden"
              style={{
                background: color,
                boxShadow: `0 0 6px ${color}66`,
                width: `${done ? 100 : pct}%`,
              }}
              initial={false}
              animate={{ width: `${done ? 100 : pct}%` }}
              transition={{ type: "spring", ...spring.progress }}
            >
              <AnimatePresence>
                {shimmerKey > 0 && (
                  <motion.div
                    key={`shimmer-${shimmerKey}`}
                    className="pointer-events-none absolute inset-0 h-full rounded-full overflow-hidden"
                    style={{
                      maskImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                    }}
                  >
                    <motion.div
                      className="pointer-events-none absolute h-full w-1/3 rounded-full bg-white/60"
                      animate={{ x: ["-130%", "130%"] }}
                      transition={{ duration: 0.6, ease: ease.circOut }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* ── Zona (b): cluster de ação (− / +), camada própria ── */}
        <div className="flex shrink-0 items-center gap-1 relative z-10 pointer-events-auto">
          {/* Botão −: sempre renderizado (reserva espaço), oculto quando indisponível. */}
          {!isSingle && (
            <motion.button
              type="button"
              disabled={decrementDisabled}
              aria-label={ariaDecrement}
              title="Remover −1"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (decrementDisabled) return;
                handleProgress("decrement");
              }}
              whileTap={reduced ? undefined : { scale: 0.92 }}
              animate={{
                opacity: decrementDisabled ? 0 : 1,
                scale: decrementDisabled ? 0.92 : 1,
              }}
              transition={{ type: "spring", ...spring.press }}
              className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)] disabled:pointer-events-none cursor-pointer"
              style={{
                opacity: decrementDisabled ? 0 : 1,
                pointerEvents: decrementDisabled ? "none" : "auto",
              }}
            >
              <Minus size={16} strokeWidth={3} />
            </motion.button>
          )}

          {/* Botão principal: + (adicionar) ou check (concluir/desconcluir). */}
          <motion.button
            type="button"
            aria-label={buttonAria()}
            title={buttonTitle()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isSingle) {
                handleProgress(done ? "decrement" : "set");
              } else if (!done) {
                handleProgress("increment");
              }
            }}
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (isSingle) {
                  handleProgress(done ? "decrement" : "set");
                } else if (!done) {
                  handleProgress("increment");
                }
              }
            }}
            whileTap={reduced ? undefined : { scale: 0.92 }}
            whileHover={reduced ? undefined : { scale: 1.04 }}
            transition={{ type: "spring", ...spring.press }}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              borderColor: `${color}55`,
              background: done ? `${color}1a` : `${color}14`,
              color,
            }}
          >
            {isSingle || done ? (
              <Check size={16} strokeWidth={3} />
            ) : (
              <Plus size={16} strokeWidth={3} />
            )}
          </motion.button>
        </div>

        {/* Chip flutuante "+1" que sobe e some. */}
        <AnimatePresence>
          {chipKey > 0 && (
            <motion.div
              key={`chip-${chipKey}`}
              className="pointer-events-none absolute -top-3 right-1/2 -translate-x-1/2 text-[10px] font-bold text-[var(--text)]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: -10 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              +1
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Zona (c): menu "⋮" separado (não fica sobre as ações) ── */}
        {onMenu && (
          <button
            type="button"
            aria-label={`Opções da meta ${title}`}
            title="Opções"
            onClick={(e) => {
              e.stopPropagation();
              onMenu(id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onMenu(id);
              }
            }}
            className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-surface-active)] hover:text-[var(--text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
          >
            <MoreVertical size={16} />
          </button>
        )}

        {/* Celebração no momento da conclusão. */}
        {celebrating && (
          <motion.div
            key="celebrate"
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: [0, 1.12, 1], rotate: [0] }}
              transition={{ type: "spring", ...spring.celebrate }}
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: color,
                color: "var(--bg-primary)",
                boxShadow: `0 0 28px ${color}`,
              }}
            >
              <Check size={30} strokeWidth={4} />
            </motion.div>
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={`particle-${i}`}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: "50%",
                  top: "50%",
                  width: 6,
                  height: 6,
                  background: color,
                  boxShadow: `0 0 12px ${color}`,
                }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{
                  x: [0, Math.sin((i * Math.PI) / 2) * 24, 0],
                  y: [0, -Math.cos((i * Math.PI) / 2) * 24, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 0.5, ease: ease.circOut }}
              />
            ))}
          </motion.div>
        )}

        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-xl"
          style={{ border: `1px solid rgba(255,255,255,0.08)`, borderRadius: "inherit" }}
        />
      </motion.div>
    </motion.div>
  );
});

GoalCardItem.displayName = "GoalCardItem";

/* ============================================================================
   GoalsCard — container: listas Ativas / Concluídas, menus, modais.
   ============================================================================ */

export function GoalsCard({
  goals,
  onProgress,
  onDelete,
  onUpdate,
  onCreate,
  categories,
}: {
  goals: Goal[];
  onProgress: (goalId: number, action: GoalLogAction) => Promise<void> | void;
  onDelete?: (goalId: number) => Promise<void> | void;
  onUpdate?: (goalId: number, patch: GoalDraft, prev: Goal) => void;
  onCreate?: (goal: Goal) => void;
  categories?: Category[];
}) {
  const reduced = useReducedMotion();
  const [showCompleted, setShowCompleted] = useState(false);
  const { active: activeGoals, completed: completedGoals } = sortGoals(goals);

  const [celebrating, setCelebrating] = useState<Set<number>>(new Set());
  const [activeMenuGoalId, setActiveMenuGoalId] = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [confirmGoalId, setConfirmGoalId] = useState<number | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<number | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [flipping, setFlipping] = useState<Set<number>>(new Set());

  const triggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

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
    setFlipping((prev) => {
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
    }, 700);
    window.setTimeout(() => {
      setFlipping((prev) => {
        const next = new Set(prev);
        next.delete(goalId);
        return next;
      });
    }, 300);
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
          <svg className="text-[var(--text-faint)] mb-3" style={{ width: 24, height: 24 }} />
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
          {activeGoals.map((goal, index) => {
            const { color, icon } = goal.category;
            const IconComp = categoryIcon(icon);
            const done = isComplete(goal);
            const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
            const deadline = deadlineLabel(goal, todayIso());
            const isCelebrating = celebrating.has(goal.id);
            const isFlipping = flipping.has(goal.id);

            return (
              <GoalCardItem
                key={goal.id}
                layoutId={goal.id}
                goal={goal}
                color={color}
                Icon={IconComp}
                done={done}
                pct={pct}
                deadline={deadline}
                onProgress={(action) => {
                  const predictsCompletion =
                    action === "set" ||
                    (action === "increment" && goal.currentValue + 1 >= goal.targetValue);
                  if (!done && predictsCompletion) celebrate(goal.id);
                  void onProgress(goal.id, action);
                }}
                onMenu={openMenu}
                onCloseMenu={closeMenu}
                celebrating={isCelebrating}
                flipping={isFlipping}
                reduced={reduced}
              />
            );
          })}

          {/* "Criar nova meta" — sempre após a última meta ativa, parte do layout. */}
          <motion.button
            layout="position"
            layoutId="create-goal-tile"
            key="create-goal-tile"
            type="button"
            onClick={() => setShowCreateModal(true)}
            whileHover={reduced ? undefined : { borderColor: "rgba(113,212,255,0.5)", color: "#71d4ff" }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            aria-label="Criar nova meta"
            className="flex min-h-[88px] h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 text-[var(--text-muted)] transition cursor-pointer"
            transition={{ type: "spring", ...spring.snappy }}
          >
            <motion.span
              whileHover={reduced ? undefined : { scale: 1.1 }}
              whileTap={reduced ? undefined : { scale: 0.94 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-current/30"
            >
              <Plus size={16} strokeWidth={2.5} />
            </motion.span>
            <span className="text-xs font-medium">Criar nova meta</span>
          </motion.button>
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
          <AnimatePresence mode="popLayout" initial={false}>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {completedGoals.map((goal) => {
                  const { color } = goal.category;
                  const done = isComplete(goal);
                  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
                  const isCelebrating = celebrating.has(goal.id);

                  return (
                    <GoalCardItem
                      key={goal.id}
                      layoutId={goal.id}
                      goal={goal}
                      color={color}
                      Icon={categoryIcon(goal.category.icon)}
                      done={done}
                      pct={pct}
                      deadline={deadlineLabel(goal, todayIso())}
                      onProgress={(action) => void onProgress(goal.id, action)}
                      onMenu={openMenu}
                      onCloseMenu={closeMenu}
                      celebrating={isCelebrating}
                      flipping={false}
                      reduced={reduced}
                    />
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Menu dropdown portado ── */}
      {activeMenuGoalId !== null && menuAnchor && typeof document !== "undefined"
        ? createPortal(
            <DropdownPortal
              anchor={menuAnchor}
              hasEdit={!!onUpdate}
              deleting={deletingGoalId === activeMenuGoalId}
              reduced={!!reduced}
              isCompleted={(() => {
                const goal = goals.find((g) => g.id === activeMenuGoalId);
                return goal ? goal.currentValue >= goal.targetValue : false;
              })()}
              onEdit={() => {
                const goal = goals.find((g) => g.id === activeMenuGoalId);
                if (goal) openEdit(goal);
              }}
              onUncomplete={async () => {
                const goal = goals.find((g) => g.id === activeMenuGoalId);
                if (goal) {
                  await onProgress(goal.id, "decrement");
                  closeMenu();
                }
              }}
              onDelete={() => setConfirmGoalId(activeMenuGoalId)}
              onConfirmDelete={() => void handleDelete(activeMenuGoalId)}
              onCancelDelete={() => setConfirmGoalId(null)}
              confirming={confirmGoalId === activeMenuGoalId}
            />,
            document.body,
          )
        : null}

      {/* ── Modal de edição ── */}
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

      {/* ── Modal de criação de nova meta ── */}
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
/*  Dropdown portado (menu kebab ancorado no trigger, fora do card)   */
/* ------------------------------------------------------------------ */

const MENU_W = 178;

function DropdownPortal({
  anchor,
  hasEdit,
  deleting,
  reduced,
  confirming,
  isCompleted,
  onEdit,
  onUncomplete,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  anchor: { top: number; left: number };
  hasEdit: boolean;
  deleting: boolean;
  reduced: boolean;
  confirming: boolean;
  isCompleted?: boolean;
  onEdit: () => void;
  onUncomplete?: () => Promise<void>;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const confirmW = 240;
  const w = confirming ? confirmW : MENU_W;
  const left = Math.max(8, Math.min(anchor.left - w + 4, window.innerWidth - w - 8));
  const top = Math.min(anchor.top, window.innerHeight - 48);

  const glowColor = "#71d4ff";

  return (
    <div data-goal-menu className="fixed z-[120]" style={{ top, left }}>
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
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(113,212,255,0.06), transparent 60%)" }} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(113,212,255,0.7), transparent)",
                boxShadow: "0 0 8px rgba(113,212,255,0.4)",
              }}
            />

            {isCompleted && onUncomplete && (
              <motion.button
                type="button"
                onClick={onUncomplete}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                className="relative flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[var(--text)] transition-colors hover:bg-white/[0.06] cursor-pointer"
              >
                <Check size={14} className="text-[#6bffb8]" />
                <span>Desconcluir</span>
              </motion.button>
            )}

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
