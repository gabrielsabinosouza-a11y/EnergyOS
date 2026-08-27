"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { CATEGORY_ICON_OPTIONS, CATEGORY_PALETTE, DEFAULT_CATEGORY_COLOR } from "@/lib/categories";

export interface CategoryFormInput {
  name: string;
  color: string;
  icon: string | null;
}

interface CategoryFormProps {
  initialName?: string;
  initialColor?: string;
  initialIcon?: string | null;
  submitLabel?: string;
  onSubmit: (input: CategoryFormInput) => Promise<void>;
  onCancel: () => void;
}

/**
 * Formulário compacto de categoria: nome (≤20 caracteres), paleta curada de
 * cores (compatível com o tema escuro, sem o vermelho de erros) e seletor
 * opcional de ícone. Usado na criação rápida (Nova meta) e no gerenciador
 * de categorias das Configurações.
 */
export function CategoryForm({
  initialName = "",
  initialColor = DEFAULT_CATEGORY_COLOR,
  initialIcon = null,
  submitLabel = "Salvar",
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Dê um nome à categoria.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), color, icon });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a categoria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Nome</label>
          <span className="text-[10px] text-[var(--text-faint)]">{name.length}/20</span>
        </div>
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
          className="auth-input py-1.5! text-xs!"
          placeholder="Ex.: Leitura"
          autoFocus
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Cor</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
              aria-pressed={color === c}
              className={`h-6 w-6 rounded-full transition-transform ${
                color === c ? "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-[var(--bg-surface)]" : "hover:scale-105"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Ícone <span className="normal-case tracking-normal text-[var(--text-faint)]">(opcional)</span>
        </label>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_ICON_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={icon === value}
              onClick={() => setIcon(icon === value ? null : value)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                icon === value
                  ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  );
}
