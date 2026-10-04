"use client";

/**
 * Modais de META (Nova meta / Editar meta).
 *
 * Meta = alvo com progresso único ou mensal. Tarefas diárias são acompanhadas
 * separadamente no painel de consistência.
 *
 * Os dois modais usam o `Modal` compartilhado (portal em document.body) no modo
 * ESTRUTURADO: painel opaco, cabeçalho/rodapé fixos, corpo rolável, max-height
 * 85vh, Esc/backdrop para fechar e bottom sheet no mobile (<640px).
 */
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import type { Category, Goal } from "@/types";
import type { GoalLogAction } from "@/lib/db/goal-logs";
import type { GoalFrequency } from "@/lib/db/goals";
import { CategoryChips } from "@/components/category-chips";
import { CategoryForm } from "@/components/category-form";
import { Modal } from "@/components/modal";
import { api } from "@/lib/api-client";

/** Campos editáveis de uma meta. */
export interface GoalDraft {
  title: string;
  categoryId: number;
  targetValue: number;
  frequency: GoalFrequency | null;
  unit: string;
  deadline: string;
}

export function draftFromGoal(goal: Goal): GoalDraft {
  return {
    title: goal.title,
    categoryId: goal.categoryId,
    targetValue: goal.targetValue,
    frequency: goal.frequency === "daily" || goal.frequency === "weekly" ? null : goal.frequency,
    unit: goal.unit ?? "",
    deadline: goal.deadline ?? "",
  };
}

export const EMPTY_GOAL_DRAFT: GoalDraft = {
  title: "",
  categoryId: 0,
  targetValue: 1,
  frequency: "unique",
  unit: "",
  deadline: "",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">{hint}</p> : null}
    </div>
  );
}

interface GoalFormParts {
  draft: GoalDraft;
  setDraft: (next: GoalDraft) => void;
  categories: Category[];
  showCategoryForm: boolean;
  setShowCategoryForm: (open: boolean) => void;
  onCategoryCreated: (input: { name: string; color: string; icon: string | null }) => Promise<void>;
  error: string;
}

const GOAL_FREQUENCIES: { value: "unique" | "monthly"; label: string; hint: string }[] = [
  { value: "unique", label: "Única", hint: "Única: termina quando você alcançar a quantidade" },
  { value: "monthly", label: "Mensal", hint: "Mensal: reinicia todo mês" },
];

/** Campos comuns aos dois modais: Título, Categoria, Quantidade, Frequência, Unidade e Prazo. */
function GoalFields({ draft, setDraft, categories, showCategoryForm, setShowCategoryForm, onCategoryCreated, error }: GoalFormParts) {
  return (
    <div className="space-y-4">
      <Field label="Título">
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="auth-input"
          placeholder="Ex: Ler 5 livros"
          autoFocus
        />
      </Field>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Categoria
        </label>
        <CategoryChips
          categories={categories}
          selectedId={draft.categoryId}
          onSelect={(id) => setDraft({ ...draft, categoryId: id })}
          onAdd={() => setShowCategoryForm(!showCategoryForm)}
          addActive={showCategoryForm}
        />
        <AnimatePresence>
          {showCategoryForm && (
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-4">
              <CategoryForm
                submitLabel="Criar categoria"
                onSubmit={onCategoryCreated}
                onCancel={() => setShowCategoryForm(false)}
              />
            </div>
          )}
        </AnimatePresence>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade alvo">
          <input
            type="number"
            min={1}
            step="any"
            value={draft.targetValue}
            onChange={(e) => setDraft({ ...draft, targetValue: Number(e.target.value) })}
            className="auth-input"
          />
        </Field>
        <Field label="Unidade" hint="Opcional: livros, horas, páginas…">
          <input
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            className="auth-input"
            placeholder="livros"
            maxLength={24}
          />
        </Field>
      </div>

      <Field label="Frequência">
        <div className="grid grid-cols-2 gap-2">
          {GOAL_FREQUENCIES.map((frequency) => (
            <button
              key={frequency.value}
              type="button"
              aria-pressed={draft.frequency === frequency.value}
              onClick={() => setDraft({ ...draft, frequency: frequency.value })}
              className={`min-h-[42px] cursor-pointer rounded-lg border px-3 text-sm font-medium transition ${
                draft.frequency === frequency.value
                  ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {frequency.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 space-y-0.5">
          {GOAL_FREQUENCIES.map((frequency) => (
            <p key={frequency.value} className="text-[11px] text-[var(--text-faint)]">{frequency.hint}</p>
          ))}
        </div>
      </Field>

      <Field label="Prazo" hint="Opcional. A meta aparece como atrasada quando o prazo passa sem conclusão.">
        <div className="relative">
          <CalendarDays
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
          />
          <input
            type="date"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
            className="auth-input pl-9"
          />
        </div>
      </Field>
    </div>
  );
}
/* ------------------------------------------------------------------ */
/*  Nova meta                                                          */
/* ------------------------------------------------------------------ */

interface CreateGoalModalProps {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (goal: Goal) => void;
}

export function CreateGoalModal({ open, categories, onClose, onCreated }: CreateGoalModalProps) {
  // Estado do formulário vive no montaje: fechar reaberta cria um rascunho limpo
  // (nenhum efeito de sincronização — e sem risco de rascunho velho).
  if (!open) return null;
  return <CreateGoalForm categories={categories} onClose={onClose} onCreated={onCreated} />;
}

function CreateGoalForm({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: (goal: Goal) => void;
}) {
  const [draft, setDraft] = useState<GoalDraft>(() => ({
    ...EMPTY_GOAL_DRAFT,
    categoryId: categories[0]?.id ?? 0,
  }));
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCategoryCreated(input: { name: string; color: string; icon: string | null }) {
    try {
      const { category } = await api.createCategory(input);
      setLocalCategories((prev) => [...prev, category]);
      setDraft((d) => ({ ...d, categoryId: category.id }));
      setShowCategoryForm(false);
    } catch {
      setError("Não foi possível criar a categoria.");
    }
  }

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.categoryId || !draft.frequency || saving) return;
    setSaving(true);
    setError("");
    try {
      const { goal } = await api.createGoal({
        title: draft.title.trim(),
        categoryId: draft.categoryId,
        targetValue: Math.max(1, draft.targetValue || 1),
        frequency: draft.frequency ?? "unique",
        unit: draft.unit.trim(),
        deadline: draft.deadline,
      });
      onCreated(goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a meta.");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova meta"
      description="Algo com fim: um alvo e, se quiser, um prazo."
      panelClassName="sm:max-w-md"
      footerClassName="justify-end"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] cursor-pointer rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!draft.title.trim() || !draft.categoryId || !draft.frequency || saving}
            className="min-h-[42px] cursor-pointer rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[#07111f] transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : "Criar meta"}
          </button>
        </>
      }
    >
      <GoalFields
        draft={draft}
        setDraft={setDraft}
        categories={localCategories}
        showCategoryForm={showCategoryForm}
        setShowCategoryForm={setShowCategoryForm}
        onCategoryCreated={handleCategoryCreated}
        error={error}
      />
    </Modal>
  );
}
/* ------------------------------------------------------------------ */
/*  Editar meta — com stepper de progresso e exclusão                  */
/* ------------------------------------------------------------------ */

interface EditGoalModalProps {
  goal: Goal;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  onSave: (patch: GoalDraft) => void;
  /** Mesmo check-in do card: o servidor paga/estorna a recompensa. */
  onProgress?: (action: GoalLogAction) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

/**
 * Estado do formulário vive no montaje do modal: cada abertura cria um rascunho
 * novo (nenhum efeito de sincronização, e nunca um rascunho velho).
 */
export function EditGoalModal(props: EditGoalModalProps) {
  if (!props.open) return null;
  return <EditGoalForm {...props} />;
}

function EditGoalForm({
  goal,
  categories,
  onClose,
  onSave,
  onProgress,
  onDelete,
}: Omit<EditGoalModalProps, "open">) {
  const [draft, setDraft] = useState<GoalDraft>(() => draftFromGoal(goal));
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [error, setError] = useState("");
  const [progressBusy, setProgressBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const target = Math.max(1, goal.targetValue);
  const goalDone = goal.currentValue >= target;
  const progressPct = goal.targetValue > 0
    ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
    : 0;

  const runProgress = async (action: GoalLogAction) => {
    if (!onProgress || progressBusy) return;
    setProgressBusy(true);
    try {
      await onProgress(action);
    } finally {
      setProgressBusy(false);
    }
  };

  const handleSave = () => {
    if (!draft.title.trim() || !draft.frequency || saving) return;
    setSaving(true);
    onSave({
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      targetValue: Math.max(1, draft.targetValue || 1),
      frequency: draft.frequency,
      unit: draft.unit.trim(),
      deadline: draft.deadline,
    });
  };

  const handleDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  async function handleCategoryCreated(input: { name: string; color: string; icon: string | null }) {
    try {
      const { category } = await api.createCategory(input);
      setLocalCategories((prev) => [...prev, category]);
      setDraft((d) => ({ ...d, categoryId: category.id }));
      setShowCategoryForm(false);
    } catch {
      setError("Não foi possível criar a categoria.");
    }
  }
return (
    <Modal
      open
      onClose={onClose}
      title="Editar meta"
      description={goalDone ? "Esta meta já foi concluída." : undefined}
      panelClassName="sm:max-w-md"
      footerClassName="justify-between"
      footer={
        <>
          {onDelete ? (
            confirmDelete ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="mr-auto text-xs text-red-400">Excluir esta meta?</span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[42px] cursor-pointer rounded-lg border border-[var(--border-subtle)] px-3 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="min-h-[42px] cursor-pointer rounded-lg bg-red-500/90 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={15} className="animate-spin" /> : "Excluir"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
              >
                <Trash2 size={15} /> Excluir meta
              </button>
            )
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] cursor-pointer rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.title.trim() || !draft.frequency || saving}
              className="min-h-[42px] cursor-pointer rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[#07111f] transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : "Salvar"}
            </button>
          </div>
        </>
      }
    >
<div className="space-y-5">
        {/* Progresso: stepper. Concluída ⇔ current >= target. */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Progresso
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text)]">
                {Math.min(goal.currentValue, target)}/{target}
                {goal.unit ? ` ${goal.unit}` : ""}
                {goalDone ? <span className="text-[#6bffb8]"> · Concluída</span> : null}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-active)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${goalDone ? 100 : progressPct}%`,
                    background: goalDone ? "var(--green)" : "var(--accent)",
                  }}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void runProgress("decrement")}
                disabled={!onProgress || progressBusy || goal.currentValue <= 0}
                aria-label="Remover −1 do progresso"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-30"
              >
                <Minus size={16} strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => void runProgress(goalDone ? "decrement" : goal.currentValue + 1 >= target ? "set" : "increment")}
                disabled={!onProgress || progressBusy}
                aria-label="Adicionar +1 ao progresso"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)] transition disabled:opacity-30"
              >
                {progressBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
            A meta é concluída quando o progresso chega ao alvo — a recompensa é paga uma única vez.
          </p>
        </div>

        <GoalFields
          draft={draft}
          setDraft={setDraft}
          categories={localCategories}
          showCategoryForm={showCategoryForm}
          setShowCategoryForm={setShowCategoryForm}
          onCategoryCreated={handleCategoryCreated}
          error={error}
        />
        {!draft.frequency ? (
          <p className="text-[11px] text-[var(--text-faint)]">
            Esta meta usa uma frequência antiga. Escolha Única ou Mensal para atualizá-la.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}