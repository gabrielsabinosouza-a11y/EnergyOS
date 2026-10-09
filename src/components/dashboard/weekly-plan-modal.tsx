"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Repeat, Hash, ChevronDown, Trash2 } from "lucide-react";
import type { WeeklyPlanSeries, Category, PlanRepeatType, PlanEndType } from "@/types";
import { Modal } from "@/components/modal";
import { ColorPalette, HABIT_COLORS } from "./color-palette";
import { PlanNameInput, PLAN_NAME_MAX } from "./plan-name-input";
import { todayIso } from "@/lib/db/dates";

const DAY_NAMES_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_NAMES_FULL = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
// JS getDay(): Sun=0, Mon=1, ... Sat=6. Our UI order: Mon=0 ... Sun=6
const JS_DAY_TO_UI_INDEX: number[] = [6, 0, 1, 2, 3, 4, 5]; // JS day → UI index
const UI_INDEX_TO_JS_DAY: number[] = [1, 2, 3, 4, 5, 6, 0]; // UI index → JS day

interface WeeklyPlanModalProps {
  series?: WeeklyPlanSeries | null;
  categories: Category[];
  prefillDate?: string;
  onClose: () => void;
  onSave: (payload: CreateSeriesPayload) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
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

const labelClass = "mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
const inputClass = "auth-input min-h-10 w-full text-sm";

export function WeeklyPlanModal({ series, categories, prefillDate, onClose, onSave, onDelete }: WeeklyPlanModalProps) {
  const isEdit = Boolean(series);

  const [title, setTitle] = useState(series?.title ?? "");
  const [color, setColor] = useState(series?.color ?? HABIT_COLORS[0]);
  const [note, setNote] = useState(series?.note ?? "");
  const [repeatType, setRepeatType] = useState<PlanRepeatType>(series?.repeatType ?? "once");
  // Convert JS day format to UI index format (Mon=0 ... Sun=6)
  const initRepeatDays = series?.repeatDays && series.repeatDays.length
    ? series.repeatDays.map((d) => JS_DAY_TO_UI_INDEX[d]).sort()
    : repeatType === "once" ? [] : [JS_DAY_TO_UI_INDEX[new Date().getDay()]];
  const [repeatDays, setRepeatDays] = useState<number[]>(initRepeatDays);
  const [repeatInterval, setRepeatInterval] = useState(series?.repeatInterval ?? 2);
  const [startTime, setStartTime] = useState(series?.startTime ?? "");
  const [durationMinutes, setDurationMinutes] = useState(series?.durationMinutes?.toString() ?? "");
  const [startDate, setStartDate] = useState(series?.startDate ?? prefillDate ?? todayIso());
  const [endType, setEndType] = useState<PlanEndType>(series?.endType ?? "never");
  const [endDate, setEndDate] = useState(series?.endDate ?? "");
  const [endCount, setEndCount] = useState(series?.endCount?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRecurring = repeatType !== "once";
  const isDirty = Boolean(series && (
    title !== series.title || color !== (series.color ?? HABIT_COLORS[0]) || note !== (series.note ?? "") ||
    repeatType !== series.repeatType || JSON.stringify(repeatDays.map((d) => UI_INDEX_TO_JS_DAY[d]).sort()) !== JSON.stringify([...(series.repeatDays ?? [])].sort()) ||
    startDate !== series.startDate || startTime !== (series.startTime ?? "") || durationMinutes !== (series.durationMinutes?.toString() ?? "") ||
    endType !== series.endType || endDate !== (series.endDate ?? "") || endCount !== (series.endCount?.toString() ?? "")
  ));
  // Confirm before discarding unsaved work. In create mode, any non-empty
  // title counts as work; in edit mode we defer to the isDirty flag.
  const shouldConfirmBeforeClose = isEdit ? isDirty : Boolean(title.trim());

  function closeModal() {
    if (saving) return;
    if (shouldConfirmBeforeClose && !window.confirm("Descartar as alterações não salvas?")) return;
    onClose();
  }

  function toggleDay(uiIndex: number) {
    setRepeatDays((prev) =>
      prev.includes(uiIndex) ? prev.filter((d) => d !== uiIndex) : [...prev, uiIndex].sort(),
    );
  }

  function getRepeatSummary(): string {
    if (repeatType === "once") return "Acontece uma única vez";
    if (!repeatDays.length) return "";
    const days = repeatDays
      .sort()
      .map((uiIdx) => DAY_NAMES_FULL[uiIdx])
      .join(", ");
    if (repeatType === "weekly") return `Repete toda ${days}`;
    if (repeatType === "interval" && repeatInterval >= 2) return `Repete ${days}, a cada ${repeatInterval} semanas`;
    return "";
  }

  async function handleSave() {
    if (saving) return;
    setError("");
    const trimmed = title.trim();
    if (!trimmed) return setError("Digite o nome do plano.");
    if (trimmed.length > PLAN_NAME_MAX) return setError(`Use até ${PLAN_NAME_MAX} caracteres. Coloque os detalhes na nota.`);
    if (isRecurring && repeatDays.length === 0) return setError("Selecione pelo menos um dia da semana.");
    if (repeatType === "interval" && (repeatInterval < 2 || repeatInterval > 8)) return setError("O intervalo deve ser de 2 a 8 semanas.");
    if (endType === "date" && !endDate) return setError("Selecione uma data de término.");
    if (endType === "count" && (!endCount || Number(endCount) < 1)) return setError("Informe quantas vezes o plano deve repetir.");

    // Convert UI day indices back to JS day format
    const jsRepeatDays = repeatDays.map((uiIdx) => UI_INDEX_TO_JS_DAY[uiIdx]);

    setSaving(true);
    try {
      await onSave({
        title: trimmed,
        categoryId: series?.categoryId ?? categories[0]?.id ?? 0,
        iconType: null,
        iconValue: null,
        color,
        note: note.trim() || null,
        repeatType,
        repeatDays: isRecurring ? jsRepeatDays : null,
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
      onClose={closeModal}
      title={isEdit ? "Editar plano" : "Novo plano"}
      description="Crie um plano para sua semana. Itens recorrentes aparecem automaticamente toda semana."
      panelClassName="sm:max-w-xl"
      footerClassName="justify-between"
      footer={
        <>
          {isEdit && onDelete && (
            confirmDelete ? <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => void onDelete()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-500/15 px-3 text-sm font-semibold text-red-200 hover:bg-red-500/25"><Trash2 size={14}/>Confirmar exclusão</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 rounded-lg px-3 text-sm text-[var(--text-muted)] hover:bg-white/5">Voltar</button>
            </div> : <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-300 hover:bg-red-400/10"><Trash2 size={14}/>Excluir</button>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-red-400" role="alert">{error}</span>
          <button type="button" onClick={closeModal} disabled={saving} className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving || title.length > PLAN_NAME_MAX || (isEdit && !isDirty)} className="inline-flex min-h-10 min-w-28 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Check size={15} /> Salvar</>}
          </button>
        </>
      }
    >
      <div className="space-y-6 pb-3">
        {/* Section 1: Title */}
        <div>
          <PlanNameInput
            id="plan-name-input"
            value={title}
            onChange={setTitle}
            color={color}
            led={false}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSave(); } }}
            placeholder="Ex.: Ir à igreja, Treino, Estudar..."
          />
        </div>

        <div>
          <span className={labelClass}>Cor</span>
          <ColorPalette selectedColor={color} onSelect={setColor} />
        </div>

        {/* Section 3: Planning Type */}
        <div>
          <span className={labelClass}>Tipo de planejamento</span>
          <div className="grid grid-cols-2 rounded-xl border border-[var(--border-subtle)] p-1">
            {(
              [
                { value: "once" as PlanRepeatType, text: "Uma vez" },
                { value: "weekly" as PlanRepeatType, text: "Recorrente" },
              ]
            ).map(({ value, text }) => (
              <button
                key={value}
                type="button"
                aria-pressed={repeatType === value}
                onClick={() => setRepeatType(value)}
                className={`flex items-center justify-center gap-2 min-h-11 rounded-lg text-sm font-medium transition-all ${
                  repeatType === value
                    ? "bg-[var(--accent)] text-white shadow-lg"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-hover)]"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Weekday Selector (animated) */}
        <AnimatePresence>
          {isRecurring && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span className={labelClass}>Dias da semana</span>
              <div className="flex gap-2">
                {DAY_NAMES_SHORT.map((name, uiIdx) => {
                  const selected = repeatDays.includes(uiIdx);
                  return (
                    <motion.button
                      key={uiIdx}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleDay(uiIdx)}
                      title={DAY_NAMES_FULL[uiIdx]}
                      whileTap={{ scale: 0.9 }}
                      animate={{ scale: selected ? 1.08 : 1 }}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-all ${
                        selected
                          ? ""
                          : "border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                      }`}
                      style={
                        selected
                          ? {
                              borderColor: `${color}80`,
                              backgroundColor: `${color}18`,
                              color,
                              boxShadow: `0 0 12px -4px ${color}40`,
                            }
                          : undefined
                      }
                    >
                      <span className="text-sm">{name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interval (for interval type) */}
        <AnimatePresence>
          {repeatType === "interval" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label>
                <span className={labelClass}>Intervalo</span>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(Math.min(8, Math.max(2, Number(e.target.value))))}
                  className={inputClass}
                />
                <span className="mt-1 block text-[10px] text-[var(--text-faint)]">A cada {repeatInterval} semanas</span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Repeat summary */}
        {getRepeatSummary() && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-3">
            <Repeat size={16} className="shrink-0 text-[var(--accent)]" />
            <span className="text-sm text-[var(--text-secondary)]">{getRepeatSummary()}</span>
          </div>
        )}

        {/* Advanced options toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <Hash size={14} />
          {showAdvanced ? "Ocultar" : "Opções avançadas"}
          <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Start date */}
              <label>
                <span className={labelClass}>Data de início</span>
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
                  <span className={labelClass}>Horário</span>
                  <input lang="pt-BR" type="time" step={60} value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Duração (min)</span>
                  <input type="number" min={1} max={480} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className={inputClass} placeholder="25" />
                </label>
              </div>

              {/* Note */}
              <label>
                <span className={labelClass}>Nota</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Lembrete ou detalhe..." />
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
