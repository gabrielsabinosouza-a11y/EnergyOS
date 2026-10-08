"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import type { UserDailyTask, HabitIconType, HabitFrequencyType, HabitGoalType } from "@/types";
import { Modal } from "@/components/modal";
import { IconPicker } from "./icon-picker";
import { ColorPalette } from "./color-palette";
import { FrequencySelector } from "./frequency-selector";
import { HABIT_LIMIT } from "@/lib/daily-limits";

interface HabitModalProps {
  habit?: UserDailyTask | null;
  habitCount?: number;
  onClose: () => void;
  onSave: (payload: {
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
  }) => void;
}

export function HabitModal({ habit, habitCount = 0, onClose, onSave }: HabitModalProps) {
  const isEdit = !!habit;
  const [title, setTitle] = useState(habit?.title ?? "");
  const [iconType, setIconType] = useState<HabitIconType>(habit?.iconType ?? "asset");
  const [iconValue, setIconValue] = useState(habit?.iconValue ?? "target");
  const [color, setColor] = useState(habit?.color ?? "#71d4ff");
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>(habit?.frequencyType ?? "daily");
  const [frequencyDays, setFrequencyDays] = useState<number[] | null>(habit?.frequencyDays ?? null);
  const [frequencyTarget, setFrequencyTarget] = useState<number | null>(habit?.frequencyTarget ?? null);
  const [goalType, setGoalType] = useState<HabitGoalType>(habit?.goalType ?? "check");
  const [targetValue, setTargetValue] = useState<string>(habit?.targetValue?.toString() ?? "");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [category, setCategory] = useState(habit?.category ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Digite o nome do hábito.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Nome muito longo (máx. 40 caracteres).");
      return;
    }
    if (!isEdit && habitCount >= HABIT_LIMIT) {
      setError(`Limite de ${HABIT_LIMIT} hábitos atingido.`);
      return;
    }

    setSaving(true);
    setSaved(true);
    setTimeout(() => {
      onSave({
        title: trimmed,
        iconType,
        iconValue,
        color,
        frequencyType,
        frequencyDays,
        frequencyTarget,
        goalType,
        targetValue: goalType === "measurable" && targetValue ? Number(targetValue) : null,
        unit: goalType === "measurable" ? unit || null : null,
        description: description || null,
        category: category || null,
        startDate: null,
        reminderTime: null,
      });
    }, 400);
  };

  const handleIconSelect = (type: HabitIconType, value: string) => {
    setIconType(type);
    setIconValue(value);
  };

  const handleFrequencyChange = (
    type: HabitFrequencyType,
    days: number[] | null,
    target: number | null,
  ) => {
    setFrequencyType(type);
    setFrequencyDays(days);
    setFrequencyTarget(target);
  };

  // Live preview icon
  const renderPreviewIcon = () => {
    if (iconType === "emoji") {
      return <span className="text-2xl">{iconValue}</span>;
    }
    if (iconType === "image") {
      return (
        <img src={iconValue} alt="Preview" className="h-8 w-8 rounded object-cover" />
      );
    }
    // asset
    return (
      <img
        src={`/icons_8bits/${iconValue}`}
        alt={iconValue.replace(".png", "")}
        className="h-8 w-8 rounded"
      />
    );
  };

  return (
    <Modal open onClose={onClose} panelClassName="max-w-lg w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
      >
        <div
          className="glass-card relative w-full overflow-hidden p-6"
          style={{ border: `1px solid ${color}30` }}
        >
          {/* Ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/2 h-44 w-80 -translate-x-1/2 rounded-full opacity-40"
            style={{ background: `radial-gradient(ellipse, ${color}55, transparent 70%)`, filter: "blur(22px)" }}
          />
          {/* LED border */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${color}99, transparent)`, boxShadow: `0 0 10px ${color}66` }}
          />

          <div className="relative">
            <div className="mb-5 flex items-center justify-between">
              <span className="eyebrow" style={{ color }}>{isEdit ? "EDITAR HÁBITO" : "NOVO HÁBITO"}</span>
              <button onClick={onClose} className="icon-button small" aria-label="Fechar">
                <X size={14} />
              </button>
            </div>

            {/* Live preview */}
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[var(--bg-surface-hover)] p-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}25` }}
              >
                {renderPreviewIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text)]">
                  {title || "Nome do hábito..."}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {frequencyType === "daily" ? "Todo dia" : frequencyType === "weekdays" ? "Dias selecionados" : `${frequencyTarget}x por semana`}
                  {goalType === "measurable" && targetValue ? ` · ${targetValue} ${unit || ""}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Nome
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="auth-input"
                  placeholder="Ex: Beber 3 litros de água"
                  maxLength={40}
                />
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  {title.length}/40 · {habitCount}/{HABIT_LIMIT} hábitos
                </p>
              </div>

              {/* Icon picker */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Ícone
                </label>
                <IconPicker iconType={iconType} iconValue={iconValue} onSelect={handleIconSelect} />
              </div>

              {/* Color */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Cor
                </label>
                <ColorPalette selectedColor={color} onSelect={setColor} />
              </div>

              {/* Frequency */}
              <FrequencySelector
                frequencyType={frequencyType}
                frequencyDays={frequencyDays}
                frequencyTarget={frequencyTarget}
                onChange={handleFrequencyChange}
              />

              {/* Goal type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Tipo de meta
                </label>
                <div className="space-y-2">
                  {([
                    { value: "check" as const, label: "Simples (feito / não feito)" },
                    { value: "measurable" as const, label: "Mensurável (ex: 3 litros)" },
                  ]).map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                        goalType === option.value
                          ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                          : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="goalType"
                        value={option.value}
                        checked={goalType === option.value}
                        onChange={() => setGoalType(option.value)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Measurable fields */}
              {goalType === "measurable" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                      Valor alvo
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="auth-input"
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                      Unidade
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="auth-input"
                      placeholder="litros"
                    />
                  </div>
                </div>
              )}

              {/* Optional fields */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="auth-input"
                  placeholder="Ex: Lembrete para hidratação"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Categoria (opcional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="auth-input"
                  placeholder="Ex: Saúde, Estudo..."
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {/* Save button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={!title.trim() || saving}
                style={{
                  background: color,
                  color: "var(--bg-primary)",
                  boxShadow: `0 0 24px -8px ${color}`,
                }}
                className="relative flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl text-xs font-bold transition-opacity disabled:opacity-40 cursor-pointer"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : saved ? (
                  <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [0.4, 1.3, 1], opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check size={15} strokeWidth={3} /> Salvo!
                  </motion.span>
                ) : (
                  <><Check size={15} strokeWidth={3} /> {isEdit ? "Salvar alterações" : "Criar hábito"}</>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </Modal>
  );
}
