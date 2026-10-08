"use client";

import type { HabitFrequencyType } from "@/types";

const WEEKDAYS = [
  { label: "Seg", day: 1 }, { label: "Ter", day: 2 }, { label: "Qua", day: 3 },
  { label: "Qui", day: 4 }, { label: "Sex", day: 5 }, { label: "Sáb", day: 6 }, { label: "Dom", day: 0 },
];

interface FrequencySelectorProps {
  frequencyType: HabitFrequencyType;
  frequencyDays: number[] | null;
  frequencyTarget: number | null;
  onChange: (type: HabitFrequencyType, days: number[] | null, target: number | null) => void;
}

export function FrequencySelector({ frequencyType, frequencyDays, frequencyTarget, onChange }: FrequencySelectorProps) {
  const toggleDay = (day: number) => {
    const days = frequencyDays ? [...frequencyDays] : [];
    const index = days.indexOf(day);
    if (index >= 0) days.splice(index, 1);
    else days.push(day);
    onChange("weekdays", days.length ? days : null, null);
  };

  return (
    <div>
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Frequência</span>
      <div className="grid grid-cols-3 rounded-lg border border-[var(--border-subtle)] p-1">
        {([ ["daily", "Todo dia"], ["weekdays", "Dias fixos"], ["times_per_week", "Por semana"] ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={frequencyType === value} onClick={() => onChange(value, value === "weekdays" ? frequencyDays : null, value === "times_per_week" ? frequencyTarget ?? 3 : null)} className={`min-h-9 rounded-md px-1 text-[11px] font-medium ${frequencyType === value ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {label}
          </button>
        ))}
      </div>
      {frequencyType === "weekdays" && (
        <div className="mt-2 flex gap-1">
          {WEEKDAYS.map(({ label, day }) => {
            const selected = frequencyDays?.includes(day) ?? false;
            return <button key={day} type="button" onClick={() => toggleDay(day)} aria-pressed={selected} aria-label={label} className={`min-h-8 flex-1 rounded-md text-[10px] font-semibold ${selected ? "bg-[var(--accent)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"}`}>{label}</button>;
          })}
        </div>
      )}
      {frequencyType === "times_per_week" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          Dias por semana
          <select value={frequencyTarget ?? 3} onChange={(event) => onChange(frequencyType, null, Number(event.target.value))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text)]">
            {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}×</option>)}
          </select>
          <span className="text-[10px]">dias fixos distribuídos pela semana</span>
        </label>
      )}
    </div>
  );
}
