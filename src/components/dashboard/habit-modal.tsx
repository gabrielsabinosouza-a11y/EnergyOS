"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { UserDailyTask, HabitIconType, HabitFrequencyType, HabitGoalType } from "@/types";
import { Modal } from "@/components/modal";
import { IconPicker } from "./icon-picker";
import { ColorPalette } from "./color-palette";
import { FrequencySelector } from "./frequency-selector";
import { HabitIcon } from "./habit-icon";
import { HABIT_LIMIT } from "@/lib/daily-limits";

export interface HabitPayload {
  title: string;
  iconType: HabitIconType;
  iconValue: string;
  color: string;
  frequencyType: HabitFrequencyType;
  frequencyDays: number[] | null;
  frequencyTarget: number | null;
  goalType: HabitGoalType;
  targetValue: number | null;
  unit: string | null;
  description: string | null;
  category: string | null;
  startDate: string | null;
  reminderTime: string | null;
}

interface HabitModalProps {
  habit?: UserDailyTask | null;
  habitCount?: number;
  onClose: () => void;
  onSave: (payload: HabitPayload) => void | Promise<void>;
}

const labelClass = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
const inputClass = "auth-input min-h-10 w-full text-sm";

export function HabitModal({ habit, habitCount = 0, onClose, onSave }: HabitModalProps) {
  const isEdit = Boolean(habit);
  const [title, setTitle] = useState(habit?.title ?? "");
  const [iconType, setIconType] = useState<HabitIconType>(habit?.iconType ?? "asset");
  const [iconValue, setIconValue] = useState(habit?.iconValue ?? "target");
  const [color, setColor] = useState(habit?.color ?? "#71d4ff");
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>(habit?.frequencyType ?? "daily");
  const [frequencyDays, setFrequencyDays] = useState<number[] | null>(habit?.frequencyDays ?? null);
  const [frequencyTarget, setFrequencyTarget] = useState<number | null>(habit?.frequencyTarget ?? null);
  const [goalType, setGoalType] = useState<HabitGoalType>(habit?.goalType ?? "check");
  const [targetValue, setTargetValue] = useState(habit?.targetValue?.toString() ?? "");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [category, setCategory] = useState(habit?.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (saving) return;
    setError("");
    const trimmed = title.trim();
    if (!trimmed) return setError("Digite o nome do hábito.");
    if (trimmed.length > 40) return setError("Nome muito longo (máx. 40 caracteres).");
    if (!isEdit && habitCount >= HABIT_LIMIT) return setError(`Limite de ${HABIT_LIMIT} hábitos ativos atingido.`);
    if (goalType === "measurable" && targetValue && (!Number.isFinite(Number(targetValue)) || Number(targetValue) <= 0)) {
      return setError("Informe um valor alvo maior que zero.");
    }

    setSaving(true);
    try {
      await onSave({
        title: trimmed,
        iconType,
        iconValue,
        color,
        frequencyType,
        frequencyDays,
        frequencyTarget,
        goalType,
        targetValue: goalType === "measurable" && targetValue ? Number(targetValue) : null,
        unit: goalType === "measurable" ? unit.trim() || null : null,
        description: description.trim() || null,
        category: category.trim() || null,
        startDate: habit?.startDate ?? null,
        reminderTime: habit?.reminderTime ?? null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o hábito.");
    } finally {
      setSaving(false);
    }
  }

  const handleFrequencyChange = (type: HabitFrequencyType, days: number[] | null, target: number | null) => {
    setFrequencyType(type);
    setFrequencyDays(days);
    setFrequencyTarget(target);
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={isEdit ? "Editar hábito" : "Novo hábito"}
      description="Ajuste os detalhes quando quiser. Seu histórico e check-ins serão mantidos."
      panelClassName="sm:max-w-xl"
      footerClassName="justify-between"
      footer={
        <>
          <span className="mr-auto truncate text-xs text-red-400" role="alert">{error}</span>
          <button type="button" onClick={onClose} disabled={saving} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving} className="inline-flex min-h-10 min-w-28 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-[#07111f] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: color }}>
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Check size={15} /> Salvar</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="shrink-0">
            <span className={labelClass}>Ícone</span>
            <HabitIcon habit={{ title, iconType, iconValue, color }} size="lg" />
          </div>
          <label className="min-w-0 flex-1">
            <span className={labelClass}>Nome</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), void handleSave())} className={inputClass} placeholder="Ex.: Beber água" maxLength={40} />
            <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{title.length}/40 · {habitCount}/{HABIT_LIMIT} hábitos ativos</span>
          </label>
        </div>

        <IconPicker iconType={iconType} iconValue={iconValue} onSelect={(type, value) => { setIconType(type); setIconValue(value); }} />

        <div>
          <span className={labelClass}>Cor</span>
          <ColorPalette selectedColor={color} onSelect={setColor} />
        </div>

        <FrequencySelector frequencyType={frequencyType} frequencyDays={frequencyDays} frequencyTarget={frequencyTarget} onChange={handleFrequencyChange} />

        <div>
          <span className={labelClass}>Tipo de meta</span>
          <div className="grid grid-cols-2 rounded-lg border border-[var(--border-subtle)] p-1">
            {([ ["check", "Simples"], ["measurable", "Mensurável"] ] as const).map(([value, text]) => (
              <button key={value} type="button" aria-pressed={goalType === value} onClick={() => setGoalType(value)} className={`min-h-9 rounded-md px-2 text-xs font-medium ${goalType === value ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                {text}
              </button>
            ))}
          </div>
        </div>

        {goalType === "measurable" && (
          <div className="grid grid-cols-2 gap-3">
            <label><span className={labelClass}>Valor alvo</span><input type="number" min={0} step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} className={inputClass} placeholder="3" /></label>
            <label><span className={labelClass}>Unidade</span><input value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass} placeholder="litros" /></label>
          </div>
        )}

        <details className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--text-secondary)]">Mais opções</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label><span className={labelClass}>Nota</span><input value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} placeholder="Lembrete opcional" /></label>
            <label><span className={labelClass}>Categoria</span><input value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} placeholder="Saúde, estudo…" /></label>
          </div>
        </details>
      </div>
    </Modal>
  );
}
