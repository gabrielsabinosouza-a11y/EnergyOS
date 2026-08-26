"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  X,
  Loader2,
  Check,
  Kanban,
  Calendar,
  Tag,
  User,
  AlertCircle,
  Trash2,
  Edit2,
  Clock,
} from "lucide-react";
import type { KanbanTask, KanbanStatus, KanbanCategory, KanbanLabel, KanbanPriority } from "@/types";

const COLUMNS: { status: KanbanStatus; label: string; color: string }[] = [
  { status: "todo", label: "A Fazer", color: "#71d4ff" },
  { status: "doing", label: "Fazendo", color: "#ffb86b" },
  { status: "done", label: "Feito", color: "#6bffb8" },
];

const CATEGORIES: KanbanCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  low: "#6bffb8",
  medium: "#ffb86b",
  high: "#ff6b6b",
};

const CATEGORY_COLORS: Record<KanbanCategory, string> = {
  FOCO: "#71d4ff",
  CORPO: "#6bffb8",
  MENTE: "#b69cff",
  ORDEM: "#ffb86b",
  ENERGIA: "#ff9f6b",
};

const LABEL_COLORS = [
  "#71d4ff",
  "#6bffb8",
  "#b69cff",
  "#ffb86b",
  "#ff9f6b",
  "#ff6b6b",
  "#ffd471",
  "#71ffb8",
];

interface KanbanBoardProps {
  tasks: KanbanTask[];
  labels: KanbanLabel[];
  onMove: (id: number, newStatus: KanbanStatus, newPosition: number) => void;
  onCreate: (task: Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: number, task: Partial<Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">>) => Promise<void>;
  onDelete: (id: number) => void;
  onCreateLabel: (name: string, color: string) => Promise<KanbanLabel>;
  onDeleteLabel: (id: number) => Promise<void>;
}

function SortableCard({
  task,
  onDelete,
  onEdit,
  labels,
}: {
  task: KanbanTask;
  onDelete: (id: number) => void;
  onEdit: (task: KanbanTask) => void;
  labels: KanbanLabel[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status, task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 0,
  };

  const taskLabelObjects = useMemo(() => {
    return task.labels
      .map((labelName) => labels.find((l) => l.name === labelName))
      .filter(Boolean) as KanbanLabel[];
  }, [task.labels, labels]);

  const isOverdue = useMemo(() => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }, [task.dueDate]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 mb-2 hover:border-[var(--border-strong)] transition-all duration-200"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab text-[var(--text-faint)] hover:text-[var(--text-muted)]"
      >
        <GripVertical size={14} />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[var(--text)] truncate">{task.title}</p>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              background: PRIORITY_COLORS[task.priority] + "20",
              color: PRIORITY_COLORS[task.priority],
            }}
          >
            {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {taskLabelObjects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {taskLabelObjects.slice(0, 2).map((label) => (
                <span
                  key={label.id}
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: label.color + "20",
                    color: label.color,
                  }}
                >
                  {label.name}
                </span>
              ))}
              {taskLabelObjects.length > 2 && (
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-faint)]">
                  +{taskLabelObjects.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-faint)]">
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? "text-amber-400" : ""}`}>
              <Calendar size={10} />
              {formatDate(task.dueDate)}
              {isOverdue && <AlertCircle size={10} className="text-red-400" />}
            </span>
          )}
          {task.assigneeId && (
            <span className="flex items-center gap-1">
              <User size={10} />
              User
            </span>
          )}
          <span
            className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-medium"
            style={{
              color: CATEGORY_COLORS[task.category],
              background: "var(--bg-tertiary)",
            }}
          >
            {task.category}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
          title="Editar"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="text-[var(--text-faint)] hover:text-red-400 transition-colors"
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

interface ColumnProps {
  status: KanbanStatus;
  label: string;
  color: string;
  tasks: KanbanTask[];
  labels: KanbanLabel[];
  onMove: (id: number, newStatus: KanbanStatus, newPosition: number) => void;
  onCreate: (task: Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: number, task: Partial<Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">>) => Promise<void>;
  onDelete: (id: number) => void;
  onCreateLabel: (name: string, color: string) => Promise<KanbanLabel>;
  onEdit: (task: KanbanTask) => void;
}

function Column({
  status,
  label,
  color,
  tasks,
  labels,
  onMove,
  onCreate,
  onUpdate,
  onDelete,
  onCreateLabel,
  onEdit,
}: ColumnProps) {
  const [showForm, setShowForm] = useState(false);
  const { setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<KanbanCategory>("FOCO");
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<KanbanPriority>("medium");
  const [saving, setSaving] = useState(false);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#71d4ff");
  const [creatingLabel, setCreatingLabel] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleCreate = useCallback(
    async () => {
      if (!newTitle.trim()) return;
      setSaving(true);
      try {
        await onCreate({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          status,
          category: newCategory,
          labels: newLabels,
          dueDate: newDueDate || undefined,
          priority: newPriority,
          assigneeId: undefined,
          position: tasks.length,
        });
        setNewTitle("");
        setNewDescription("");
        setNewLabels([]);
        setNewDueDate("");
        setNewPriority("medium");
        setShowForm(false);
      } finally {
        setSaving(false);
      }
    },
    [newTitle, newDescription, newCategory, newLabels, newDueDate, newPriority, status, tasks.length, onCreate]
  );

  const handleCreateLabel = useCallback(
    async () => {
      if (!newLabelName.trim()) return;
      setCreatingLabel(true);
      try {
        const label = await onCreateLabel(newLabelName.trim(), newLabelColor);
        setNewLabels((prev) => [...prev, label.name]);
        setNewLabelName("");
        setShowLabelSelector(false);
      } finally {
        setCreatingLabel(false);
      }
    },
    [newLabelName, newLabelColor, onCreateLabel]
  );

  const toggleLabel = useCallback(
    (labelName: string) => {
      setNewLabels((prev) =>
        prev.includes(labelName) ? prev.filter((l) => l !== labelName) : [...prev, labelName]
      );
    },
    []
  );

  const availableLabels = useMemo(() => {
    return labels.filter((l) => !newLabels.includes(l.name));
  }, [labels, newLabels]);

  return (
    <div
      ref={setNodeRef}
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3"
      data-status={status}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: `0 0 8px ${color}40` }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--text-muted)]">{label}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
          >
            <Plus size={12} />
          </button>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tasks.length > 0 ? "bg-[var(--bg-surface-hover)] text-[var(--text-muted)]" : "text-[var(--text-faint)]"
            }`}
          >
            {tasks.length}
          </span>
        </span>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 space-y-3">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="auth-input flex-1 text-sm"
                  placeholder="Título da tarefa..."
                />
                <button
                  onClick={handleCreate}
                  disabled={saving || !newTitle.trim()}
                  className="icon-button small"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
              </div>

              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="auth-input w-full text-sm min-h-[60px] resize-none"
                placeholder="Descrição (opcional)..."
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Categoria</label>
                  <div className="flex gap-1 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`answer-option !w-auto !px-2 !py-0.5 !text-[9px] ${
                          newCategory === cat ? "selected" : ""
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Prioridade</label>
                  <div className="flex gap-1">
                    {(Object.keys(PRIORITY_COLORS) as KanbanPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setNewPriority(p)}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg transition-colors ${
                          newPriority === p
                            ? "bg-[var(--bg-surface-hover)] text-[var(--text)]"
                            : "text-[var(--text-faint)] hover:bg-[var(--bg-tertiary)]"
                        }`}
                        style={{
                          border: newPriority === p ? `1px solid ${PRIORITY_COLORS[p]}` : "none",
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: PRIORITY_COLORS[p] }}
                        />
                        {p === "high" ? "Alta" : p === "medium" ? "Média" : "Baixa"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-faint)] mb-1 block">
                  Etiquetas
                  <button
                    onClick={() => setShowLabelSelector(!showLabelSelector)}
                    className="ml-1 text-[var(--text-faint)] hover:text-[var(--text)]"
                  >
                    <Plus size={10} />
                  </button>
                </label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {newLabels.map((labelName) => {
                    const label = labels.find((l) => l.name === labelName);
                    return (
                      <button
                        key={labelName}
                        onClick={() => toggleLabel(labelName)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg bg-[var(--bg-surface)] text-[var(--text)]"
                        style={{ border: `1px solid ${label?.color || "#71d4ff"}` }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: label?.color || "#71d4ff" }}
                        />
                        {labelName}
                        <X size={10} className="text-[var(--text-faint)]" />
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showLabelSelector && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 mb-2"
                    >
                      <div className="flex gap-1 flex-wrap mb-2">
                        {availableLabels.map((label) => (
                          <button
                            key={label.id}
                            onClick={() => toggleLabel(label.name)}
                            className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
                            style={{ color: label.color }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: label.color }}
                            />
                            {label.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex gap-1">
                          {LABEL_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setNewLabelColor(c)}
                              className={`w-4 h-4 rounded-full transition-all ${
                                newLabelColor === c ? "ring-2 ring-white" : ""
                              }`}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                        <input
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                          className="auth-input flex-1 text-[10px]"
                          placeholder="Nova etiqueta..."
                        />
                        <button
                          onClick={handleCreateLabel}
                          disabled={creatingLabel || !newLabelName.trim()}
                          className="text-[var(--text-faint)] hover:text-[var(--text)]"
                        >
                          {creatingLabel ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[var(--text-faint)]" />
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-transparent text-sm text-[var(--text)] border-none outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[80px] rounded-lg">
          {tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-[80px] text-[var(--text-faint)]"
            >
              <Plus size={20} className="mb-1 opacity-50" />
              <span className="text-[10px]">Nenhuma tarefa ainda</span>
              <button
                onClick={() => setShowForm(true)}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] mt-1 flex items-center gap-1"
              >
                <Plus size={10} /> Adicionar tarefa
              </button>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {tasks.map((task) => (
                <SortableCard
                  key={task.id}
                  task={task}
                  onDelete={onDelete}
                  onEdit={() => onEdit(task)}
                  labels={labels}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface TaskDetailModalProps {
  task: KanbanTask;
  labels: KanbanLabel[];
  onClose: () => void;
  onSave: (task: Partial<Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">>) => Promise<void>;
  onDelete: (id: number) => void;
  onCreateLabel: (name: string, color: string) => Promise<KanbanLabel>;
}

function TaskDetailModal({ task, labels, onClose, onSave, onDelete, onCreateLabel }: TaskDetailModalProps) {
  const [editedTask, setEditedTask] = useState({
    title: task.title,
    description: task.description || "",
    category: task.category,
    labels: [...task.labels],
    dueDate: task.dueDate || "",
    priority: task.priority,
  });
  const [saving, setSaving] = useState(false);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#71d4ff");
  const [creatingLabel, setCreatingLabel] = useState(false);

  const toggleLabel = useCallback((labelName: string) => {
    setEditedTask((prev) => ({
      ...prev,
      labels: prev.labels.includes(labelName)
        ? prev.labels.filter((l) => l !== labelName)
        : [...prev.labels, labelName],
    }));
  }, []);

  const handleCreateLabel = useCallback(
    async () => {
      if (!newLabelName.trim()) return;
      setCreatingLabel(true);
      try {
        const label = await onCreateLabel(newLabelName.trim(), newLabelColor);
        toggleLabel(label.name);
        setNewLabelName("");
        setShowLabelSelector(false);
      } finally {
        setCreatingLabel(false);
      }
    },
    [newLabelName, newLabelColor, onCreateLabel, toggleLabel]
  );

  const handleSave = useCallback(
    async () => {
      setSaving(true);
      try {
        await onSave({
          title: editedTask.title,
          description: editedTask.description || undefined,
          category: editedTask.category,
          labels: editedTask.labels,
          dueDate: editedTask.dueDate || undefined,
          priority: editedTask.priority,
        });
        onClose();
      } finally {
        setSaving(false);
      }
    },
    [editedTask, onSave, onClose]
  );

  const availableLabels = useMemo(() => {
    return labels.filter((l) => !editedTask.labels.includes(l.name));
  }, [labels, editedTask.labels]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: CATEGORY_COLORS[task.category],
                boxShadow: `0 0 6px ${CATEGORY_COLORS[task.category]}40`,
              }}
            />
            <span className="text-sm font-medium text-[var(--text)]">Editar Tarefa</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Título</label>
            <input
              value={editedTask.title}
              onChange={(e) =>
                setEditedTask((prev) => ({ ...prev, title: e.target.value }))
              }
              className="auth-input w-full text-sm"
              placeholder="Título da tarefa..."
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Descrição</label>
            <textarea
              value={editedTask.description}
              onChange={(e) =>
                setEditedTask((prev) => ({ ...prev, description: e.target.value }))
              }
              className="auth-input w-full text-sm min-h-[100px] resize-none"
              placeholder="Descrição da tarefa..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Categoria</label>
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setEditedTask((prev) => ({ ...prev, category: cat }))
                    }
                    className={`answer-option !w-auto !px-2 !py-0.5 !text-[9px] ${
                      editedTask.category === cat ? "selected" : ""
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Prioridade</label>
              <div className="flex gap-1">
                {(Object.keys(PRIORITY_COLORS) as KanbanPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setEditedTask((prev) => ({ ...prev, priority: p }))
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg transition-colors ${
                      editedTask.priority === p
                        ? "bg-[var(--bg-surface-hover)] text-[var(--text)]"
                        : "text-[var(--text-faint)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                    style={{
                      border:
                        editedTask.priority === p
                          ? `1px solid ${PRIORITY_COLORS[p]}`
                          : "none",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: PRIORITY_COLORS[p] }}
                    />
                    {p === "high" ? "Alta" : p === "medium" ? "Média" : "Baixa"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-faint)] mb-1 block">
              Etiquetas
              <button
                onClick={() => setShowLabelSelector(!showLabelSelector)}
                className="ml-1 text-[var(--text-faint)] hover:text-[var(--text)]"
              >
                <Plus size={10} />
              </button>
            </label>
            <div className="flex flex-wrap gap-1 mb-1">
              {editedTask.labels.map((labelName) => {
                const label = labels.find((l) => l.name === labelName);
                return (
                  <button
                    key={labelName}
                    onClick={() => toggleLabel(labelName)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg bg-[var(--bg-surface)] text-[var(--text)]"
                    style={{ border: `1px solid ${label?.color || "#71d4ff"}` }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: label?.color || "#71d4ff" }}
                    />
                    {labelName}
                    <X size={10} className="text-[var(--text-faint)]" />
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {showLabelSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 mb-2"
                >
                  <div className="flex gap-1 flex-wrap mb-2">
                    {availableLabels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => toggleLabel(label.name)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
                        style={{ color: label.color }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: label.color }}
                        />
                        {label.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          className={`w-4 h-4 rounded-full transition-all ${
                            newLabelColor === c ? "ring-2 ring-white" : ""
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <input
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                      className="auth-input flex-1 text-[10px]"
                      placeholder="Nova etiqueta..."
                    />
                    <button
                      onClick={handleCreateLabel}
                      disabled={creatingLabel || !newLabelName.trim()}
                      className="text-[var(--text-faint)] hover:text-[var(--text)]"
                    >
                      {creatingLabel ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--text-faint)]" />
            <input
              type="date"
              value={editedTask.dueDate}
              onChange={(e) =>
                setEditedTask((prev) => ({ ...prev, dueDate: e.target.value }))
              }
              className="bg-transparent text-sm text-[var(--text)] border-none outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={() => {
              onDelete(task.id);
              onClose();
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <Trash2 size={14} /> Excluir
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editedTask.title.trim()}
            className="flex items-center gap-1 px-4 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function KanbanBoard({
  tasks,
  labels,
  onMove,
  onCreate,
  onUpdate,
  onDelete,
  onCreateLabel,
  onDeleteLabel,
}: KanbanBoardProps) {
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleMove = useCallback(
    (id: number, newStatus: KanbanStatus, newPosition: number) => {
      onMove(id, newStatus, newPosition);
    },
    [onMove]
  );

  const handleCreate = useCallback(
    async (task: Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">) => {
      await onCreate(task);
    },
    [onCreate]
  );

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<Omit<KanbanTask, "id" | "profileId" | "createdAt" | "updatedAt">>) => {
      await onUpdate(id, updates);
      setEditingTask((prev) => (prev?.id === id ? null : prev));
    },
    [onUpdate]
  );

  const handleEdit = useCallback((task: KanbanTask) => {
    setEditingTask(task);
  }, []);

  const columnTasks = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      tasks: tasks.filter((t) => t.status === col.status).sort((a, b) => a.position - b.position),
    }));
  }, [tasks]);

  return (
    <div className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban size={18} className="text-[var(--accent)]" />
          <span className="eyebrow muted">KANBAN</span>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
        const { active, over } = e;
        if (!over) return;
        const activeId = Number(active.id);
        const activeData = active.data.current as { status?: KanbanStatus; task?: KanbanTask };
        const overData = over.data.current as { status?: KanbanStatus; task?: KanbanTask };
        
        if (!activeData?.status) return;
        
        const oldStatus = activeData.status;
        const newStatus = overData?.status || overData?.task?.status || oldStatus;
        
        if (oldStatus === newStatus) {
          if (overData?.task) {
            const overId = Number(over.id);
            const columnTasks = tasks.filter((t) => t.status === oldStatus).sort((a, b) => a.position - b.position);
            const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
            const newIndex = columnTasks.findIndex((t) => t.id === overId);
            if (oldIndex !== newIndex) {
              const newPosition = newIndex;
              handleMove(activeId, oldStatus, newPosition);
            }
          }
        } else {
          let newPosition = 0;
          if (overData?.task) {
            const overId = Number(over.id);
            const tasksInNewColumn = tasks.filter((t) => t.status === newStatus).sort((a, b) => a.position - b.position);
            const overIndex = tasksInNewColumn.findIndex((t) => t.id === overId);
            newPosition = overIndex >= 0 ? overIndex : tasksInNewColumn.length;
          } else if (overData?.status) {
            const tasksInNewColumn = tasks.filter((t) => t.status === newStatus);
            newPosition = tasksInNewColumn.length;
          }
          handleMove(activeId, newStatus, newPosition);
        }
      }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {columnTasks.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              color={col.color}
              tasks={col.tasks}
              labels={labels}
              onMove={handleMove}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={onDelete}
              onCreateLabel={onCreateLabel}
              onEdit={handleEdit}
            />
          ))}
        </div>
      </DndContext>

      <AnimatePresence>
        {editingTask && (
          <TaskDetailModal
            task={editingTask}
            labels={labels}
            onClose={() => setEditingTask(null)}
            onSave={(updates) => handleUpdate(editingTask.id, updates)}
            onDelete={onDelete}
            onCreateLabel={onCreateLabel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
