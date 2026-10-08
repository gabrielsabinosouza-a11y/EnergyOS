"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Minus, Loader2, Trash2, Pencil, GripVertical, Sparkles } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { api } from "@/lib/api-client";
import { useDailyQuests } from "@/lib/quest-store";
import { CoinIcon } from "@/components/coin-icon";
import { RewardClaimModal } from "@/components/reward-claim-modal";
import { HabitModal, type HabitPayload } from "./habit-modal";
import { HabitIcon } from "./habit-icon";
import { HABIT_DAILY_REWARD_LIMIT, HABIT_XP, HABIT_COINS, HABIT_ALL_BONUS_COINS } from "@/lib/daily-limits";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RecurringDailyTasksProps {
  coins: number;
  onCoinsChange: (coins: number) => void;
  onXpGain?: (xp: number) => void;
}

function SortableHabitRow({
  task,
  onProgress,
  busy,
  onDelete,
  onEdit,
}: {
  task: UserDailyTask;
  onProgress: (task: UserDailyTask, completedCount: number) => void;
  busy: boolean;
  onDelete: (id: number) => void;
  onEdit: (task: UserDailyTask) => void;
}) {
  const [progressOpen, setProgressOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const remainingCount = Math.max(0, task.dailyTarget - task.completedCount);
  const progressPercent = Math.round((task.completedCount / task.dailyTarget) * 100);

  return (
    <motion.div
      ref={setNodeRef}
      key={task.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, height: 0 }}
      className="group relative flex items-center gap-2 border-b border-[var(--border-subtle)] py-2.5 last:border-0"
      onMouseEnter={() => { if (task.dailyTarget > 1) setProgressOpen(true); }}
      onMouseLeave={() => setProgressOpen(false)}
      onFocusCapture={() => { if (task.dailyTarget > 1) setProgressOpen(true); }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProgressOpen(false);
      }}
      aria-busy={busy}
      style={{ ...style, zIndex: progressOpen ? 40 : undefined }}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-[var(--text-faint)] hover:text-[var(--text-muted)] active:cursor-grabbing"
        aria-label="Reordenar hábito"
      >
        <GripVertical size={14} />
      </button>

      <HabitIcon habit={task} size="sm" />

      {task.dailyTarget === 1 ? (
        <button
          type="button"
          onClick={() => onProgress(task, task.isCompleted ? 0 : 1)}
          disabled={busy}
          aria-label={`${task.isCompleted ? "Desmarcar" : "Concluir"} ${task.title}`}
          aria-pressed={task.isCompleted}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${task.isCompleted ? "border-[var(--accent)] bg-[var(--accent)] text-slate-950" : "border-[var(--border-strong)] text-transparent hover:border-[var(--accent)]"}`}
        >
          <Check size={14} />
        </button>
      ) : (
        <div className="group/target relative shrink-0">
          <button
            type="button"
            id={`habit-progress-trigger-${task.id}`}
            onClick={() => {
              if (window.matchMedia("(hover: hover)").matches) setProgressOpen(true);
              else setProgressOpen((isOpen) => !isOpen);
            }}
            aria-expanded={progressOpen}
            aria-haspopup="dialog"
            aria-controls={`habit-progress-tooltip-${task.id}`}
            aria-label={`Ver check-ins de hoje para ${task.title}: ${task.completedCount} de ${task.dailyTarget}`}
            title={`Check-ins de hoje: ${task.completedCount}/${task.dailyTarget}`}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-[10px] font-mono font-semibold transition hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${task.isCompleted ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : task.completedCount > 0 ? "border-cyan-400/40 bg-cyan-400/5 text-cyan-200" : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-cyan-400/40 hover:text-cyan-200"}`}
          >
            <Plus size={12} />
            <span>{task.completedCount}/{task.dailyTarget}</span>
            {task.isCompleted && <Check size={11} aria-label="Meta concluída" />}
          </button>
          <AnimatePresence>
          {progressOpen && task.dailyTarget > 1 && <motion.div
            id={`habit-progress-tooltip-${task.id}`}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background: "linear-gradient(145deg, rgba(12,24,43,0.94), rgba(10,15,30,0.78))",
              boxShadow: "0 20px 48px rgba(0,0,0,0.48), 0 0 24px rgba(70,190,255,0.14), inset 0 1px 0 rgba(210,245,255,0.12)",
              transformOrigin: "bottom center",
            }}
            role="dialog"
            aria-label={`Check-ins de hoje para ${task.title}`}
            className="absolute bottom-full left-1/2 z-30 mb-3 w-64 -translate-x-1/2 rounded-2xl border border-cyan-200/15 p-4 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate text-[11px] font-semibold text-[var(--text)]"><Sparkles size={12} className="text-cyan-200" /> Progresso de hoje</span>
              <span className={`font-mono text-xs font-semibold ${task.isCompleted ? "text-emerald-300" : "text-cyan-200"}`}>{task.completedCount}/{task.dailyTarget}</span>
            </div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{task.completedCount} de {task.dailyTarget} check-ins</span>
              <span className="text-[10px] text-[var(--text-muted)]">{remainingCount === 0 ? "Concluído" : remainingCount + " restante" + (remainingCount === 1 ? "" : "s")}</span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/[0.08] shadow-inner">
              <motion.div
                className={`h-full rounded-full ${task.isCompleted ? "bg-gradient-to-r from-emerald-400 to-lime-300" : "bg-gradient-to-r from-cyan-400 to-sky-300"}`}
                initial={{ width: 0 }}
                animate={{ width: progressPercent + "%" }}
                transition={{ type: "spring", stiffness: 170, damping: 24 }}
                style={{ boxShadow: task.isCompleted ? "0 0 12px rgba(74,222,128,0.55)" : "0 0 12px rgba(56,189,248,0.55)" }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-black/10 p-1">
              <button type="button" onClick={() => onProgress(task, Math.max(0, task.completedCount - 1))} disabled={busy || task.completedCount <= 0} className="grid h-8 w-9 place-items-center rounded-md text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-white disabled:opacity-30" aria-label={`Diminuir check-ins de ${task.title}`}><Minus size={14} /></button>
              <span className="font-mono text-sm font-semibold text-[var(--text)]" role="progressbar" aria-valuemin={0} aria-valuemax={task.dailyTarget} aria-valuenow={task.completedCount}>{task.completedCount} / {task.dailyTarget}</span>
              <button type="button" onClick={() => onProgress(task, Math.min(task.dailyTarget, task.completedCount + 1))} disabled={busy || task.isCompleted} className="grid h-8 w-9 place-items-center rounded-md text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-white disabled:opacity-30" aria-label={`Adicionar check-in para ${task.title}`}><Plus size={14} /></button>
            </div>
            {task.isCompleted && <p className="mt-2 text-center text-[10px] font-medium text-emerald-300">Meta diária concluída</p>}
          </motion.div>}
          </AnimatePresence>
        </div>
      )}

      <span className={`flex-1 text-left text-sm ${task.isCompleted ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}>
        {task.title}
      </span>

      {task.goalType === "measurable" && task.targetValue && (
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          {task.currentProgress}/{task.targetValue} {task.unit}
        </span>
      )}

      <div className="flex gap-0.5 opacity-40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={() => onEdit(task)}
          className="icon-button small !h-6 !w-6 text-[var(--text-faint)] hover:text-[var(--text)]"
          aria-label="Editar hábito"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="icon-button small !h-6 !w-6 text-red-400/60 hover:text-red-400"
          aria-label="Excluir hábito"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </motion.div>
  );
}

export function RecurringDailyTasks({ coins, onCoinsChange, onXpGain }: RecurringDailyTasksProps) {
  const { refresh: refreshQuests } = useDailyQuests();
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [habitCount, setHabitCount] = useState(0);
  const [saveNotice, setSaveNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [rewardModal, setRewardModal] = useState<{ coins: number; xp: number; balance: number } | null>(null);
  const [progressBusyId, setProgressBusyId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<{ mode: "create" | "edit"; habit?: UserDailyTask } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const completed = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getDailyTasks(), api.getDailyTasks(true)])
      .then(([data, all]) => {
        if (!cancelled) {
          setTasks(data.tasks);
          setHabitCount(all.tasks.length);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProgress(task: UserDailyTask, completedCount: number) {
    if (progressBusyId !== null) return;
    const nextCount = Math.max(0, Math.min(task.dailyTarget, completedCount));
    const prev = tasks;
    setProgressBusyId(task.id);
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, completedCount: nextCount, isCompleted: nextCount >= task.dailyTarget } : t));
    try {
      const data = await api.setDailyTaskProgress(task.id, nextCount);
      setTasks((ts) => ts.map((t) => (t.id === task.id ? data.task : t)));
      if (data.coinsAwarded > 0) {
        const newCoins = coins + data.coinsAwarded;
        onCoinsChange(newCoins);
        setRewardModal({ coins: data.coinsAwarded, xp: data.xpAwarded, balance: newCoins });
      }
      if (data.xpAwarded > 0) onXpGain?.(data.xpAwarded);
      void refreshQuests();
    } catch {
      setTasks(prev);
      void refreshQuests();
    } finally {
      setProgressBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.deleteDailyTask(id);
      setHabitCount((count) => Math.max(0, count - 1));
    } catch {
      setTasks(prev);
    }
  }

  async function handleCreate(payload: HabitPayload) {
    try {
      const data = await api.createDailyTask(payload);
      setTasks((t) => [...t, data.task]);
      setHabitCount((count) => count + 1);
      setSaveNotice("Hábito criado.");
      setModalState(null);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Não foi possível criar o hábito.");
    }
  }

  async function handleEdit(payload: HabitPayload) {
    if (!modalState?.habit) return;
    try {
      const data = await api.updateDailyTask(modalState.habit.id, payload);
      setTasks((ts) => ts.map((t) => (t.id === data.task.id ? data.task : t)));
      setSaveNotice("Alterações salvas.");
      setModalState(null);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Não foi possível salvar as alterações.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = tasks.findIndex((t) => t.id === Number(active.id));
      const newIndex = tasks.findIndex((t) => t.id === Number(over!.id));
      const newTasks = arrayMove(tasks, oldIndex, newIndex);
      setTasks(newTasks);
      try {
        await api.reorderDailyTasks(newTasks.map((t) => t.id));
      } catch {
        setTasks(tasks);
      }
    }
  }

  return (
    <>
    <div className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="eyebrow muted">HÁBITOS</span>
        </div>
        <button
          onClick={() => { setSaveNotice(""); setModalState({ mode: "create" }); }}
          className="icon-button small"
          aria-label="Adicionar hábito"
        >
          <Plus size={18} />
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
        Os primeiros {HABIT_DAILY_REWARD_LIMIT} hábitos concluídos no dia rendem <b className="text-[var(--green)] font-mono">+{HABIT_XP} XP</b> e{" "}
        <span className="inline-flex items-baseline gap-1"><CoinIcon size={12} /><b className="text-[var(--green)] font-mono">+{HABIT_COINS} moedas</b></span>
        {HABIT_ALL_BONUS_COINS > 0 && <> — e{" "}<span className="inline-flex items-baseline gap-1"><CoinIcon size={12} /><b className="text-[var(--green)] font-mono">+{HABIT_ALL_BONUS_COINS} moedas</b></span> de bônus ao completar todos</>}.
      </p>
      {saveNotice && <p role="status" className="mb-3 text-xs text-[var(--green)]">{saveNotice}</p>}

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <div className="progress-track flex-1">
            <div className="progress-value" style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{completed}/{total}</span>
          {allDone && <span className="text-[10px] text-[var(--green)] font-medium">✦ tudo feito hoje!</span>}
        </div>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && (
        <div className="empty-state py-8">
          <strong>Nenhum hábito ainda</strong>
          <span>Clique + para criar seu primeiro hábito</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}

      {/* Habit list with drag-and-drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {tasks.map((task) => (
              <SortableHabitRow
                key={task.id}
                task={task}
                onProgress={handleProgress}
                busy={progressBusyId === task.id}
                onDelete={handleDelete}
                onEdit={(t) => setModalState({ mode: "edit", habit: t })}
              />
            ))}
          </AnimatePresence>
        </SortableContext>
      </DndContext>

      <RewardClaimModal reward={rewardModal} onClose={() => setRewardModal(null)} />
    </div>

    {modalState && (
      <HabitModal
        key={modalState.mode === "edit" ? modalState.habit!.id : "new"}
        habit={modalState.mode === "edit" ? modalState.habit : undefined}
          habitCount={habitCount}
        onClose={() => setModalState(null)}
        onSave={modalState.mode === "edit" ? handleEdit : handleCreate}
      />
    )}
    </>
  );
}
