"use client";

import { CalendarDays, LayoutGrid, List } from "lucide-react";

interface ViewSwitcherProps {
  view: "month" | "week" | "day";
  onChange: (view: "month" | "week" | "day") => void;
}

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  const views = [
    { id: "month", label: "Mês", icon: CalendarDays },
    { id: "week", label: "Semana", icon: LayoutGrid },
    { id: "day", label: "Dia", icon: List },
  ] as const;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
      {views.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            view === id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
          }`}
          aria-pressed={view === id}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
