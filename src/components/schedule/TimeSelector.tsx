"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

interface TimeSelectorProps {
  startTime: string;
  endTime: string;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
}

export function TimeSelector({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
}: TimeSelectorProps) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-[var(--text)]">
          Horário da atividade
        </h3>

        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Defina quando esta atividade começa e termina para que ela seja
          organizada corretamente na agenda semanal.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowStartPicker(true)}
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-hover)] p-4 text-left"
        >
          <div className="mb-2 flex items-center gap-2">
            <Clock size={14} />
            <span className="text-xs text-[var(--text-muted)]">
              Início
            </span>
          </div>

          <div className="text-lg font-semibold">
            {startTime || "Selecionar"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowEndPicker(true)}
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-hover)] p-4 text-left"
        >
          <div className="mb-2 flex items-center gap-2">
            <Clock size={14} />
            <span className="text-xs text-[var(--text-muted)]">
              Fim
            </span>
          </div>

          <div className="text-lg font-semibold">
            {endTime || "Selecionar"}
          </div>
        </button>
      </div>

      {showStartPicker && (
        <input
          type="time"
          autoFocus
          value={startTime}
          onChange={(e) => {
            onStartChange(e.target.value);
            setShowStartPicker(false);
          }}
          className="hidden"
        />
      )}

      {showEndPicker && (
        <input
          type="time"
          autoFocus
          value={endTime}
          onChange={(e) => {
            onEndChange(e.target.value);
            setShowEndPicker(false);
          }}
          className="hidden"
        />
      )}
    </div>
  );
}
