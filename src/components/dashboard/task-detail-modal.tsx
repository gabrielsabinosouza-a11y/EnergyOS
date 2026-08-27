"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, Loader2, Calendar, Trash2 } from "lucide-react";
import type { Category, KanbanTask, KanbanStatus, KanbanLabel, KanbanPriority } from "@/types";
import { sortCategoriesForPicker } from "@/lib/categories";
import { CategoryChips } from "@/components/category-chips";
import { Modal } from "@/components/modal";

export const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  low: "#6bffb8",
  medium: "#ffb86b",
  high: "#ff6b6b",
};

export const LABEL_COLORS = [
  "#71d4ff",
  "#6bffb8",
  "#b69cff",
  "#ffb86b",
  "#ff9f6b",
  "#ff6b6b",
  "#ffd471",
  "#71ffb8",
];

export const KANBAN_STATUSES: KanbanStatus[] = ["todo", "doing", "done"];

export type TaskDetailSaveInput = Partial<Omit<KanbanTask, "id" | "profileId" | "category" | "createdAt" | "updatedAt">>;

interface TaskDetailModalProps {
  open?: boolean;
  task: KanbanTask;
  labels?: KanbanLabel[];
  categories: Category[];
  title?: string;
  onClose: () => void;
  onSave: (updates: TaskDetailSaveInput) => Promise<void>;
  onDelete?: (id: number) => void;
  onCreateLabel?: (name: string, color: string) => Promise<KanbanLabel>;
  onToggleComplete?: (task: KanbanTask) => Promise<void> | void;
  showDescription?: boolean;
  showPriority?: boolean;
  showLabels?: boolean;
  showDueDate?: boolean;
}

export function TaskDetailModal({
  open = true,
  task,
  labels = [],
  categories,
  title = "Editar Tarefa",
  onClose,
  onSave,
  onDelete,
  onCreateLabel,
  onToggleComplete,
  showDescription = true,
  showPriority = true,
  showLabels = true,
  showDueDate = true,
}: TaskDetailModalProps) {
  const sortedCategories = sortCategoriesForPicker(categories);
  const [editedTask, setEditedTask] = useState({
    title: task.title,
    description: task.description || "",
    categoryId: task.categoryId,
    labels: [...task.labels],
    dueDate: task.dueDate || "",
    priority: task.priority,
  });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
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
      if (!newLabelName.trim() || !onCreateLabel) return;
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
          categoryId: editedTask.categoryId,
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

  const handleToggleComplete = useCallback(
    async () => {
      if (!onToggleComplete) return;
      setToggling(true);
      try {
        await onToggleComplete(task);
      } finally {
        setToggling(false);
      }
    },
    [onToggleComplete, task]
  );

  const availableLabels = useMemo(() => {
    return labels.filter((l) => !editedTask.labels.includes(l.name));
  }, [labels, editedTask.labels]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: task.category.color,
                boxShadow: `0 0 6px ${task.category.color}40`,
              }}
            />
            <span className="text-sm font-medium text-[var(--text)]">{title}</span>
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

          {showDescription && (
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-[var(--text-faint)] mb-1 block">Categoria</label>
              <CategoryChips
                categories={sortedCategories}
                selectedId={editedTask.categoryId}
                onSelect={(id) => setEditedTask((prev) => ({ ...prev, categoryId: id }))}
              />
            </div>
            {showPriority && (
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
            )}
          </div>

          {showLabels && (
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
                {showLabelSelector && onCreateLabel && (
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
          )}

          {showDueDate && (
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
          )}
        </div>

        <div className="mt-6 flex gap-2 justify-end items-center">
          {onToggleComplete && (
            <button
              onClick={handleToggleComplete}
              disabled={toggling}
              className="mr-auto flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50"
              style={{
                color: task.status === "done" ? "#ffb86b" : "var(--green)",
                background: task.status === "done" ? "rgba(255,184,107,.1)" : "var(--green-bg)",
              }}
            >
              {toggling ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {task.status === "done" ? "Reabrir" : "Concluir"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                onDelete(task.id);
                onClose();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              <Trash2 size={14} /> Excluir
            </button>
          )}
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
    </Modal>
  );
}