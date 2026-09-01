"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, X, Loader2, Pencil, Trash2, Zap, ListTodo } from "lucide-react";
import type { Category, Task } from "@/types";
import { sortCategoriesForPicker } from "@/lib/categories";
import { CategoryChips } from "@/components/category-chips";

interface TodoListProps {
  tasks: Task[];
  categories: Category[];
  onToggle: (task: Task) => void;
  onDelete: (id: number) => void;
  onCreate: (title: string, categoryId: number) => Promise<void>;
  onUpdate: (id: number, title: string, categoryId: number) => Promise<void>;
  onPromote?: (taskId: number) => void;
  streakQualified: boolean;
}

export function TodoList({ tasks, categories, onToggle, onDelete, onCreate, onUpdate, onPromote, streakQualified }: TodoListProps) {
  const sortedCategories = sortCategoriesForPicker(categories);
  // Rápido contexto diário "Hoje": só categorias acionáveis de check-off, sem "Sono"
  // (o sono é rastreado pelo fluxo de Check-in separado). "Nova meta" e Kanban mantêm o conjunto completo.
  const hojeCategories = sortedCategories.filter((c) => c.name !== "Sono");
  const firstCategoryId = sortedCategories[0]?.id ?? 0;
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState(0);
  const [justCompleted, setJustCompleted] = useState<number | null>(null);

  const completed = tasks.filter((t) => Boolean(t.completedAt)).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const selectedCategoryId = newCategoryId || firstCategoryId;
  const selectedEditCategoryId = editCategoryId || firstCategoryId;

  async function handleCreate() {
    if (!newTitle.trim() || !selectedCategoryId) return;
    setSaving(true);
    await onCreate(newTitle.trim(), selectedCategoryId);
    setNewTitle("");
    setShowForm(false);
    setSaving(false);
  }

  function handleToggle(task: Task) {
    if (!task.completedAt) {
      setJustCompleted(task.id);
      setTimeout(() => setJustCompleted(null), 1500);
    }
    onToggle(task);
  }

  return (
    <div className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-[var(--accent)]" />
          <span className="eyebrow muted">HOJE</span>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="icon-button small">
          {showForm ? <X size={16} /> : <Plus size={18} />}
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <div className="progress-track flex-1">
            <div className="progress-value" style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{completed}/{total}</span>
          <span className="text-[10px] text-[var(--text-faint)]">{streakQualified ? "✦ streak" : "continuar"}</span>
        </div>
      )}

      {/* New task form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-3">
            <div className="flex gap-2 mb-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="auth-input flex-1"
                placeholder="Nova tarefa..."
              />
              <button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="icon-button small">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
            </div>
            <CategoryChips
              categories={hojeCategories}
              selectedId={selectedCategoryId}
              onSelect={setNewCategoryId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      {tasks.length === 0 && !showForm && (
        <div className="empty-state py-8">
          <strong>Nenhuma tarefa hoje</strong>
          <span>Clique + para adicionar</span>
        </div>
      )}

      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16, height: 0 }}
            className="group flex items-center gap-2 py-2.5 border-b border-[var(--border-subtle)] last:border-0"
          >
            {editingId === task.id ? (
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(task.id, editTitle, selectedEditCategoryId); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                  className="auth-input !py-1 !text-sm flex-1 min-w-0"
                />
                <CategoryChips
                  categories={hojeCategories}
                  selectedId={selectedEditCategoryId}
                  onSelect={setEditCategoryId}
                  compact
                />
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => { onUpdate(task.id, editTitle, selectedEditCategoryId); setEditingId(null); }} className="icon-button small !w-6 !h-6" title="Salvar"><Check size={12} /></button>
                  <button onClick={() => setEditingId(null)} className="icon-button small !w-6 !h-6" title="Cancelar"><X size={12} /></button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleToggle(task)}
                  className={`task-check shrink-0 ${task.completedAt ? "border-[#71d4ff] bg-[#71d4ff]" : ""}`}
                >
                  {task.completedAt && <Check size={11} />}
                </button>
                <span className={`flex-1 text-left text-sm ${task.completedAt ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>{task.title}</span>
                <AnimatePresence>
                  {justCompleted === task.id && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-0.5 text-[10px] text-[#ffb86b] font-mono"
                    >
                      <Zap size={10} fill="currentColor" />+10
                    </motion.span>
                  )}
                </AnimatePresence>
                <span
                  className="hidden items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium sm:flex"
                  style={{ color: task.category.color, background: `${task.category.color}1a` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.category.color }} />
                  {task.category.name}
                </span>
                <div className="flex gap-0.5 opacity-40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button onClick={() => { setEditingId(task.id); setEditTitle(task.title); setEditCategoryId(task.categoryId); }} className="icon-button small !w-6 !h-6"><Pencil size={10} /></button>
                  {onPromote && (
                    <button onClick={() => onPromote(task.id)} className="icon-button small !w-6 !h-6 text-[#ffb86b]/60 hover:text-[#ffb86b]" title="Promover para Kanban">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                  <button onClick={() => onDelete(task.id)} className="icon-button small !w-6 !h-6 text-red-400/60 hover:text-red-400"><Trash2 size={10} /></button>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
