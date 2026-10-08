"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Repeat, Clock, Hash } from "lucide-react";
import type { WeeklyPlanSeries, Category, PlanRepeatType, PlanEndType } from "@/types";
import { Modal } from "@/components/modal";
import { ColorPalette, HABIT_COLORS } from "./color-palette";
import { SMART_PLANNER_CATEGORIES, type SmartCategory } from "@/lib/categories";
import { SmartCategoryChips } from "@/components/category-chips";
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

/** Map smart category names to DB category IDs by matching names. */
function findCategoryIdByName(categories: Category[], smartCat: SmartCategory): number {
  // Try exact match first, then case-insensitive
  const lower = smartCat.name.toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.id;
  // Fallback: find by partial match
  const partial = categories.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
  if (partial) return partial.id;
  // Last resort: first category
  return categories[0]?.id ?? 0;
}

export function WeeklyPlanModal({ series, categories, prefillDate, onClose, onSave }: WeeklyPlanModalProps) {
  const isEdit = Boolean(series);

  // Map smart categories to DB category IDs
  const smartCategoryMap = useMemo(() => {
    const map = new Map<number, number>(); // smartId -> dbCategoryId
    SMART_PLANNER_CATEGORIES.forEach((sc) => {
      map.set(sc.id, findCategoryIdByName(categories, sc));
    });
    return map;
  }, [categories]);

  // Find which smart category matches the current DB category
  const findSmartCategoryId = (dbCategoryId: number): number => {
    const dbCat = categories.find((c) => c.id === dbCategoryId);
    if (!dbCat) return 1;
    const smartCat = SMART_PLANNER_CATEGORIES.find((sc) => sc.name.toLowerCase() === dbCat.name.toLowerCase());
    return smartCat?.id ?? 9; // Default to "Outros"
  };

  const [title, setTitle] = useState(series?.title ?? "");
  const [smartCategoryId, setSmartCategoryId] = useState(series ? findSmartCategoryId(series.categoryId) : 1);
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

  const isRecurring = repeatType !== "once";

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
    if (trimmed.length > 60) return setError("Nome muito longo (máx. 60 caracteres).");
    if (isRecurring && repeatDays.length === 0) return setError("Selecione pelo menos um dia da semana.");
    if (repeatType === "interval" && (repeatInterval < 2 || repeatInterval > 8)) return setError("O intervalo deve ser de 2 a 8 semanas.");
    if (endType === "date" && !endDate) return setError("Selecione uma data de término.");
    if (endType === "count" && (!endCount || Number(endCount) < 1)) return setError("Informe quantas vezes o plano deve repetir.");

    // Convert UI day indices back to JS day format
    const jsRepeatDays = repeatDays.map((uiIdx) => UI_INDEX_TO_JS_DAY[uiIdx]);

    setSaving(true);
    try {
      const dbCategoryId = smartCategoryMap.get(smartCategoryId) ?? categories[0]?.id ?? 0;
      await onSave({
        title: trimmed,
        categoryId: dbCategoryId,
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
      onClose={saving ? () => {} : onClose}
      title={isEdit ? "Editar plano" : "Novo plano"}
      description="Crie um plano para sua semana. Itens recorrentes aparecem automaticamente toda semana."
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
      <div className="space-y-5">
        {/* Section 1: Title */}
        <div>
          <label className={labelClass}>Nome da atividade</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void handleSave())}
            className={inputClass}
            placeholder="Ex.: Ir à igreja, Treino, Estudar..."
            maxLength={60}
          />
          <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{title.length}/60</span>
        </div>

        {/* Section 2: Smart Categories */}
        <div>
          <span className={labelClass}>Categoria</span>
          <SmartCategoryChips
            categories={SMART_PLANNER_CATEGORIES}
            selectedId={smartCategoryId}
            onSelect={setSmartCategoryId}
          />
        </div>

        {/* Section 3: Planning Type */}
        <div>
          <span className={labelClass}>Tipo de planejamento</span>
          <div className="grid grid-cols-2 rounded-xl border border-[var(--border-subtle)] p-1">
            {(
              [
                { value: "once" as PlanRepeatType, emoji: "⏱️", text: "Uma vez" },
                { value: "weekly" as PlanRepeatType, emoji: "🔄", text: "Recorrente" },
              ]
            ).map(({ value, emoji, text }) => (
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
                <span>{emoji}</span>
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
          <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▼</span>
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
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputClass} pl-9`} />
                  </div>
                </label>
                <label>
                  <span className={labelClass}>Duração (min)</span>
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
