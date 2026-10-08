"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Loader2, Trash2, Pencil, GripVertical } from "lucide-react";
import type { UserDailyTask } from "@/types";
import { api } from "@/lib/api-client";
import { toggleDailyTaskCompletion } from "@/lib/daily-task-actions";
import { useDailyQuests } from "@/lib/quest-store";
import { CoinIcon } from "@/components/coin-icon";
import { RewardClaimModal } from "@/components/reward-claim-modal";
import { HabitModal } from "./habit-modal";
import { HABIT_XP, HABIT_COINS, HABIT_ALL_BONUS_COINS } from "@/lib/daily-limits";
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

function HabitIcon({ task }: { task: UserDailyTask }) {
  if (task.iconType === "emoji") {
    return <span className="text-lg">{task.iconValue}</span>;
  }
  if (task.iconType === "image") {
    return (
      <img src={task.iconValue} alt={task.title} className="h-5 w-5 rounded object-cover" />
    );
  }
  return (
    <img
      src={`/icons_8bits/${task.iconValue}`}
      alt={task.iconValue.replace(".png", "")}
      className="h-5 w-5 rounded"
    />
  );
}

function SortableHabitRow({
  task,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: UserDailyTask;
  onToggle: (task: UserDailyTask) => void;
  onDelete: (id: number) => void;
  onEdit: (task: UserDailyTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      key={task.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, height: 0 }}
      className="group flex items-center gap-2 border-b border-[var(--border-subtle)] py-2.5 last:border-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-[var(--text-faint)] hover:text-[var(--text-muted)] active:cursor-grabbing"
        aria-label="Reordenar hábito"
      >
        <GripVertical size={14} />
      </button>

      <div
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${task.color}20` }}
      >
        <HabitIcon task={task} />
      </div>

      <button
        onClick={() => onToggle(task)}
        className={`task-check shrink-0 ${task.isCompleted ? "border-[#71d4ff] bg-[#71d4ff]" : ""}`}
        aria-label={task.isCompleted ? "Desmarcar" : "Concluir"}
        style={
          task.isCompleted
            ? { backgroundColor: task.color, borderColor: task.color }
            : { borderColor: `${task.color}60` }
        }
      >
        {task.isCompleted && <Check size={11} />}
      </button>

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
  const { applyMetric, refresh: refreshQuests } = useDailyQuests();
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ id: number; xp: number; coins: number } | null>(null);
  const [rewardModal, setRewardModal] = useState<{ coins: number; xp: number; balance: number } | null>(null);
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
    api
      .getDailyTasks()
      .then((data) => {
        if (!cancelled) {
          setTasks(data.tasks);
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

  async function handleToggle(task: UserDailyTask) {
    const completing = !task.isCompleted;
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, isCompleted: completing } : t)));
    if (completing) {
      applyMetric("TASKS_COMPLETED", { incrementBy: 1 });
      applyMetric("XP_EARNED", { incrementBy: HABIT_XP });
    }
    try {
      const data = await toggleDailyTaskCompletion(task.id, completing);
      setTasks((ts) => ts.map((t) => (t.id === task.id ? data.task : t)));
      if (data.coinsAwarded > 0) {
        const newCoins = coins + data.coinsAwarded;
        onCoinsChange(newCoins);
        setRewardModal({ coins: data.coinsAwarded, xp: data.xpAwarded, balance: newCoins });
      }
      if (data.xpAwarded > 0) onXpGain?.(data.xpAwarded);
      if (data.xpAwarded > 0 || data.coinsAwarded > 0) {
        setFeedback({ id: task.id, xp: data.xpAwarded, coins: data.coinsAwarded });
        setTimeout(() => setFeedback(null), 1600);
      }
      void refreshQuests();
    } catch {
      setTasks(prev);
      void refreshQuests();
    }
  }

  async function handleDelete(id: number) {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.deleteDailyTask(id);
    } catch {
      setTasks(prev);
    }
  }

  async function handleCreate(payload: {
    title: string;
    iconType: string;
    iconValue: string;
    color: string;
    frequencyType: string;
    frequencyDays: number[] | null;
    frequencyTarget: number | null;
    goalType: string;
    targetValue: number | null;
    unit: string | null;
    description: string | null;
    category: string | null;
    startDate: string | null;
    reminderTime: string | null;
  }) {
    const prev = tasks;
    try {
      const data = await api.createDailyTask(payload);
      setTasks((t) => [...t, data.task]);
      setModalState(null);
    } catch {
      setTasks(prev);
    }
  }

  async function handleEdit(payload: {
    title: string;
    iconType: string;
    iconValue: string;
    color: string;
    frequencyType: string;
    frequencyDays: number[] | null;
    frequencyTarget: number | null;
    goalType: string;
    targetValue: number | null;
    unit: string | null;
    description: string | null;
    category: string | null;
    startDate: string | null;
    reminderTime: string | null;
  }) {
    if (!modalState?.habit) return;
    const prev = tasks;
    try {
      const data = await api.updateDailyTask(modalState.habit.id, payload);
      setTasks((ts) => ts.map((t) => (t.id === data.task.id ? data.task : t)));
      setModalState(null);
    } catch {
      setTasks(prev);
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
          onClick={() => setModalState({ mode: "create" })}
          className="icon-button small"
          aria-label="Adicionar hábito"
        >
          <Plus size={18} />
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
        Complete cada hábito para ganhar <b className="text-[var(--green)] font-mono">+{HABIT_XP} XP</b> e{" "}
        <span className="inline-flex items-baseline gap-1"><CoinIcon size={12} /><b className="text-[var(--green)] font-mono">+{HABIT_COINS} moedas</b></span>
        {HABIT_ALL_BONUS_COINS > 0 && <> — e{" "}<span className="inline-flex items-baseline gap-1"><CoinIcon size={12} /><b className="text-[var(--green)] font-mono">+{HABIT_ALL_BONUS_COINS} moedas</b></span> de bônus ao completar todos</>}.
      </p>

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
                onToggle={handleToggle}
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
        habitCount={tasks.length}
        onClose={() => setModalState(null)}
        onSave={modalState.mode === "edit" ? handleEdit : handleCreate}
      />
    )}
    </>
  );
}

