"use client";

import { Clock } from "lucide-react";

interface TimeInputChipProps {
  label: string;
  value?: string;
  onClick: () => void;
}

export function TimeInputChip({
  label,
  value,
  onClick,
}: TimeInputChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        rounded-xl
        border
        border-[var(--glass-border)]
        bg-[var(--glass-bg-hover)]
        p-4
        text-left
        transition-all
        hover:border-[var(--accent)]
        hover:shadow-lg
      "
    >
      <div className="mb-2 flex items-center gap-2">
        <Clock size={14} />
        <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
      </div>

      <div className="text-lg font-semibold text-[var(--text)]">
        {value || "Selecionar"}
      </div>
    </button>
  );
}
