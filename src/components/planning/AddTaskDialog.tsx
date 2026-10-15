"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/types";
import { api } from "@/lib/api-client";
import { PLAN_NAME_MAX } from "@/lib/daily-limits";
import { todayIso } from "@/lib/planning/dates";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { X } from "lucide-react";

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  /** Data pré-selecionada para o novo plano (YYYY-MM-DD). Padrão: hoje. */
  planDate?: string;
  /** Recebe (planDate, title, categoryId) e deve persistir o plano. */
  onCreate: (planDate: string, title: string, categoryId: number | undefined) => Promise<void>;
}

export function AddTaskDialog({ open, onClose, planDate, onCreate }: AddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultCategory = categories[0] ?? null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getCategories();
        if (!mounted) return;
        setCategories(res.categories || []);
        if (res.categories?.[0]) setCategoryId(res.categories[0].id);
      } catch {
        // sem categorias: o usuário ainda poderá enviar e a categoria padrão será resolvida no servidor
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Informe o título do plano.");
      return;
    }
    if (title.trim().length > PLAN_NAME_MAX) {
      setError(`Use até ${PLAN_NAME_MAX} caracteres.`);
      return;
    }
    setLoading(true);
    try {
      const effectiveDate = planDate ?? todayIso();
      const catId = categoryId ?? defaultCategory?.id;
      // A página é dona da chamada à API e da atualização da lista local.
      await onCreate(effectiveDate, title.trim(), catId ?? undefined);
      setTitle("");
      setCategoryId(null);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Não foi possível criar o plano. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo plano"
      description="Preencha o título e escolha a categoria."
      variant="center"
      panelClassName="max-w-[440px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Título
          </label>
          <input
            ref={inputRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Ir à academia"
            maxLength={PLAN_NAME_MAX}
            className="auth-input"
            aria-required="true"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Categoria
          </label>
          <select
            value={categoryId ?? defaultCategory?.id ?? ""}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="auth-input"
            aria-label="Categoria do plano"
          >
            <option value="">Padrão</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Fechar
          </Button>
          <Button type="submit" loading={loading} disabled={loading}>
            Criar plano
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
      >
        <X size={16} />
      </button>
    </Modal>
  );
}
