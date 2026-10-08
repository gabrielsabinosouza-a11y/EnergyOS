"use client";

import type { HabitFrequencyType } from "@/types";

const WEEKDAYS = [
  { key: "seg", label: "Seg", day: 1 },
  { key: "ter", label: "Ter", day: 2 },
  { key: "qua", label: "Qua", day: 3 },
  { key: "qui", label: "Qui", day: 4 },
  { key: "sex", label: "Sex", day: 5 },
  { key: "sab", label: "Sáb", day: 6 },
  { key: "dom", label: "Dom", day: 0 },
];

interface FrequencySelectorProps {
  frequencyType: HabitFrequencyType;
  frequencyDays: number[] | null;
  frequencyTarget: number | null;
  onChange: (type: HabitFrequencyType, days: number[] | null, target: number | null) => void;
}

export function FrequencySelector({
  frequencyType,
  frequencyDays,
  frequencyTarget,
  onChange,
}: FrequencySelectorProps) {
  const toggleDay = (day: number) => {
    const days = frequencyDays ? [...frequencyDays] : [];
    const idx = days.indexOf(day);
    if (idx >= 0) {
      days.splice(idx, 1);
    } else {
      days.push(day);
    }
    onChange(frequencyType, days.length ? days : null, frequencyTarget);
  };

  return (
    <div className="space-y-4">
      {/* Frequency type radio */}
      <div className="space-y-2">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Frequência
        </label>
        {([
          { value: "daily" as const, label: "Todo dia" },
          { value: "weekdays" as const, label: "Dias da semana" },
          { value: "times_per_week" as const, label: "X vezes por semana" },
        ]).map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
              frequencyType === option.value
                ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
            }`}
          >
            <input
              type="radio"
              name="frequencyType"
              value={option.value}
              checked={frequencyType === option.value}
              onChange={() => onChange(option.value, option.value === "weekdays" ? frequencyDays : null, option.value === "times_per_week" ? frequencyTarget : null)}
              className="accent-[var(--accent)]"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>

      {/* Weekday toggles */}
      {frequencyType === "weekdays" && (
        <div className="flex gap-1.5">
          {WEEKDAYS.map((wd) => {
            const isActive = frequencyDays?.includes(wd.day);
            return (
              <button
                key={wd.key}
                type="button"
                onClick={() => toggleDay(wd.day)}
                aria-pressed={isActive}
                title={wd.label}
                className={`flex h-9 w-11 items-center justify-center rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:bg-[var(--border-subtle)]"
                }`}
              >
                {wd.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Times per week input */}
      {frequencyType === "times_per_week" && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
            Quantas vezes por semana?
          </label>
          <input
            type="number"
            min={1}
            max={7}
            value={frequencyTarget ?? 3}
            onChange={(e) => {
              const val = Math.min(7, Math.max(1, Number(e.target.value) || 1));
              onChange(frequencyType, null, val);
            }}
            className="auth-input w-20"
          />
        </div>
      )}
    </div>
  );
}
