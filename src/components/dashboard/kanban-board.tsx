"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Loader2, Check, Kanban } from "lucide-react";
import type { KanbanTask, KanbanStatus, KanbanCategory } from "@/types";

const COLUMNS: { status: KanbanStatus; label: string; color: string }[] = [
  { status: "todo", label: "A Fazer", color: "#71d4ff" },
  { status: "doing", label: "Fazendo", color: "#ffb86b" },
  { status: "done", label: "Feito", color: "#6bffb8" },
];

const CATEGORIES: KanbanCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onMove: (id: number, newStatus: KanbanStatus) => void;
  onCreate: (title: string, category: KanbanCategory) => Promise<void>;
  onDelete: (id: number) => void;
}

function SortableCard({ task, onDelete }: { task: KanbanTask; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-2.5 mb-2 hover:border-[var(--border-strong)] transition-colors">
      <button {...attributes} {...listeners} className="mt-0.5 cursor-grab text-[var(--text-faint)] hover:text-[var(--text-muted)]">
        <GripVertical size={12} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--text)] truncate">{task.title}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-medium" style={{ color: task.category === "FOCO" ? "#71d4ff" : task.category === "CORPO" ? "#6bffb8" : task.category === "MENTE" ? "#b69cff" : task.category === "ORDEM" ? "#ffb86b" : "#ff9f6b", background: "var(--bg-tertiary)" }}>{task.category}</span>
        </div>
      </div>
      <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-faint)] hover:text-red-400">
        <X size={11} />
      </button>
    </div>
  );
}

export function KanbanBoard({ tasks, onMove, onCreate, onDelete }: KanbanBoardProps) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<KanbanCategory>("FOCO");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    await onCreate(newTitle.trim(), newCategory);
    setNewTitle("");
    setShowForm(false);
    setSaving(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = Number(active.id);
    const overData = over.data.current;
    if (overData?.status) {
      onMove(activeId, overData.status as KanbanStatus);
    }
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">KANBAN</span>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="icon-button small">
          {showForm ? <X size={16} /> : <Plus size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 space-y-2">
              <div className="flex gap-2">
                <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} className="auth-input flex-1 text-sm" placeholder="Novo card..." />
                <button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="icon-button small">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setNewCategory(cat)} className={`answer-option !w-auto !px-2 !py-0.5 !text-[9px] ${newCategory === cat ? "selected" : ""}`}>{cat}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-3 gap-3">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-2.5">
                <div className="mb-2.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}40` }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--text-muted)]">{col.label}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-faint)]">{colTasks.length}</span>
                </div>
                <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div
                    className="min-h-[60px] rounded-lg"
                    data-status={col.status}
                  >
                    {colTasks.length === 0 && (
                      <div className="flex items-center justify-center h-[60px] text-[10px] text-[var(--text-faint)]">Vazio</div>
                    )}
                    <AnimatePresence>
                      {colTasks.map((task) => (
                        <SortableCard key={task.id} task={task} onDelete={onDelete} />
                      ))}
                    </AnimatePresence>
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
