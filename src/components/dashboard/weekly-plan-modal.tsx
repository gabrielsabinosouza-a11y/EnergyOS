"use client";

import { useState } from "react";
import { Check, Loader2, Repeat } from "lucide-react";
import type { WeeklyPlanSeries, Category, PlanRepeatType, PlanEndType } from "@/types";
import { Modal } from "@/components/modal";
import { ColorPalette, HABIT_COLORS } from "./color-palette";
import { sortCategoriesForPicker } from "@/lib/categories";
import { CategoryChips } from "@/components/category-chips";
import { todayIso } from "@/lib/db/dates";

const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_NAMES_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

interface WeeklyPlanModalProps {
  series?: WeeklyPlanSeries | null;
  categories: Category[];
  prefillDate?: string;
  onClose: () => void;
  onSave: (payload: CreateSeriesPayload) => void | Promise<void>;
}

export interface CreateSeriesPayload {
  title: string;
  categoryId: number;
  iconType: "asset" | "emoji" | "image" | null;
  iconValue: string | null;
  color: string | null;
  note: string | null;
  repeatType: PlanRepeatType;
  repeatDays: number[] | null;
  repeatInterval: number | null;
  startTime: string | null;
  durationMinutes: number | null;
  startDate: string;
  endType: PlanEndType;
  endDate: string | null;
  endCount: number | null;
}

const labelClass = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
const inputClass = "auth-input min-h-10 w-full text-sm";

export function WeeklyPlanModal({ series, categories, prefillDate, onClose, onSave }: WeeklyPlanModalProps) {
  const isEdit = Boolean(series);
  const sortedCategories = sortCategoriesForPicker(categories);
  const firstCategoryId = sortedCategories[0]?.id ?? 0;

  const [title, setTitle] = useState(series?.title ?? "");
  const [categoryId, setCategoryId] = useState(series?.categoryId ?? firstCategoryId);
  const [iconType, _setIconType] = useState<"asset" | "emoji" | "image" | null>(series?.iconType ?? null);
  const [iconValue, _setIconValue] = useState(series?.iconValue ?? null);
  const [color, setColor] = useState(series?.color ?? HABIT_COLORS[0]);
  const [note, setNote] = useState(series?.note ?? "");
  const [repeatType, setRepeatType] = useState<PlanRepeatType>(series?.repeatType ?? "once");
  const [repeatDays, setRepeatDays] = useState<number[]>(series?.repeatDays && series.repeatDays.length
    ? series.repeatDays
    : repeatType === "once" ? [] : [new Date().getDay()]);
  const [repeatInterval, setRepeatInterval] = useState(series?.repeatInterval ?? 1);
  const [startTime, setStartTime] = useState(series?.startTime ?? "");
  const [durationMinutes, setDurationMinutes] = useState(series?.durationMinutes?.toString() ?? "");
  const [startDate, setStartDate] = useState(series?.startDate ?? prefillDate ?? todayIso());
  const [endType, setEndType] = useState<PlanEndType>(series?.endType ?? "never");
  const [endDate, setEndDate] = useState(series?.endDate ?? "");
  const [endCount, setEndCount] = useState(series?.endCount?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleDay(day: number) {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function getRepeatSummary(): string {
    if (repeatType === "once") return "Acontece uma única vez";
    if (!repeatDays.length) return "";
    const days = repeatDays
      .sort()
      .map((d) => DAY_NAMES_FULL[d])
      .join(", ");
    if (repeatType === "weekly") return `Repete todo ${days}`;
    if (repeatType === "interval" && repeatInterval >= 2) return `Repete ${days}, a cada ${repeatInterval} semanas`;
    return "";
  }

  async function handleSave() {
    if (saving) return;
    setError("");
    const trimmed = title.trim();
    if (!trimmed) return setError("Digite o nome do plano.");
    if (trimmed.length > 60) return setError("Nome muito longo (máx. 60 caracteres).");
    if (repeatType !== "once" && repeatDays.length === 0) return setError("Selecione pelo menos um dia da semana.");
    if (repeatType === "interval" && (repeatInterval < 2 || repeatInterval > 8)) return setError("O intervalo deve ser de 2 a 8 semanas.");
    if (endType === "date" && !endDate) return setError("Selecione uma data de término.");
    if (endType === "count" && (!endCount || Number(endCount) < 1)) return setError("Informe quantas vezes o plano deve repetir.");

    setSaving(true);
    try {
      await onSave({
        title: trimmed,
        categoryId,
        iconType,
        iconValue,
        color,
        note: note.trim() || null,
        repeatType,
        repeatDays: repeatType === "once" ? null : repeatDays,
        repeatInterval: repeatType === "interval" ? repeatInterval : null,
        startTime: startTime || null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        startDate,
        endType,
        endDate: endType === "date" ? endDate : null,
        endCount: endType === "count" ? Number(endCount) : null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={isEdit ? "Editar plano" : "Novo plano"}
      description="Adicione um item ao seu plano da semana. Você pode repetir semanalmente ou a cada X semanas."
      panelClassName="sm:max-w-xl"
      footerClassName="justify-between"
      footer={
        <>
          <span className="mr-auto truncate text-xs text-red-400" role="alert">{error}</span>
          <button type="button" onClick={onClose} disabled={saving} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving} className="inline-flex min-h-10 min-w-28 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Check size={15} /> Salvar</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Title */}
        <label>
          <span className={labelClass}>Nome</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void handleSave())} className={inputClass} placeholder="Ex.: Estudar inglês" maxLength={60} />
          <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{title.length}/60</span>
        </label>

        {/* Category */}
        <div>
          <span className={labelClass}>Categoria</span>
          <CategoryChips categories={sortedCategories} selectedId={categoryId} onSelect={setCategoryId} compact />
        </div>

        {/* Repeat type */}
        <div>
          <span className={labelClass}>Repetir</span>
          <div className="grid grid-cols-3 rounded-lg border border-[var(--border-subtle)] p-1">
            {([
              ["once", "Só uma vez"],
              ["weekly", "Toda semana"],
              ["interval", "A cada X sem."],
            ] as const).map(([value, text]) => (
              <button key={value} type="button" aria-pressed={repeatType === value} onClick={() => setRepeatType(value)} className={`min-h-9 rounded-md px-2 text-xs font-medium ${repeatType === value ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Weekday toggles */}
        {repeatType !== "once" && (
          <div>
            <span className={labelClass}>Dias da semana</span>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={repeatDays.includes(day)}
                  onClick={() => toggleDay(day)}
                  title={DAY_NAMES_FULL[day]}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition ${
                    repeatDays.includes(day)
                      ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                      : "border border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text)]"
                  }`}
                >
                  {DAY_NAMES_SHORT[day].slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interval */}
        {repeatType === "interval" && (
          <label>
            <span className={labelClass}>Intervalo (semanas)</span>
            <input type="number" min={2} max={8} value={repeatInterval} onChange={(e) => setRepeatInterval(Math.min(8, Math.max(2, Number(e.target.value))))} className={inputClass} />
          </label>
        )}

        {/* Repeat summary */}
        {getRepeatSummary() && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-2">
            <Repeat size={14} className="shrink-0 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-secondary)]">{getRepeatSummary()}</span>
          </div>
        )}

        {/* Start date */}
        <label>
          <span className={labelClass}>Início</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </label>

        {/* End rule */}
        <div>
          <span className={labelClass}>Término</span>
          <div className="grid grid-cols-3 rounded-lg border border-[var(--border-subtle)] p-1">
            {([
              ["never", "Nunca"],
              ["date", "Em uma data"],
              ["count", "Após N vezes"],
            ] as const).map(([value, text]) => (
              <button key={value} type="button" aria-pressed={endType === value} onClick={() => setEndType(value)} className={`min-h-9 rounded-md px-2 text-xs font-medium ${endType === value ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                {text}
              </button>
            ))}
          </div>
        </div>

        {endType === "date" && (
          <label>
            <span className={labelClass}>Data de término</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} min={startDate} />
          </label>
        )}

        {endType === "count" && (
          <label>
            <span className={labelClass}>Número de repetições</span>
            <input type="number" min={1} max={52} value={endCount} onChange={(e) => setEndCount(e.target.value)} className={inputClass} placeholder="4" />
          </label>
        )}

        {/* Time & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={labelClass}>Horário (opcional)</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Duração (min, opcional)</span>
            <input type="number" min={1} max={480} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className={inputClass} placeholder="25" />
          </label>
        </div>

        {/* Color */}
        <div>
          <span className={labelClass}>Cor</span>
          <ColorPalette selectedColor={color} onSelect={setColor} />
        </div>

        {/* Note */}
        <label>
          <span className={labelClass}>Nota (opcional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Lembrete ou detalhe" />
        </label>
      </div>
    </Modal>
  );
}
