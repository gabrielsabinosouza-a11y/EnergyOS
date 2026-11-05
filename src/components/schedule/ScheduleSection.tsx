"use client";

import { useState } from "react";

import { TimeInputChip } from "./TimeInputChip";
import { TimePickerModal } from "./TimePickerModal";

interface ScheduleSectionProps {
  startTime: string;
  endTime: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function ScheduleSection({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
}: ScheduleSectionProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Agenda
        </span>

        <p className="text-xs text-[var(--text-muted)]">
          Defina quando a atividade começa e termina.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <TimeInputChip
            label="Início"
            value={startTime}
            onClick={() => setStartOpen(true)}
          />

          <TimeInputChip
            label="Fim"
            value={endTime}
            onClick={() => setEndOpen(true)}
          />
        </div>
      </div>

      <TimePickerModal
        open={startOpen}
        title="Horário de início"
        value={startTime}
        onChange={onStartChange}
        onClose={() => setStartOpen(false)}
      />

      <TimePickerModal
        open={endOpen}
        title="Horário de término"
        value={endTime}
        onChange={onEndChange}
        onClose={() => setEndOpen(false)}
      />
    </>
  );
}
