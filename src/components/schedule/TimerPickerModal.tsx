"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClockDial } from "./ClockDial";

interface TimePickerModalProps {
  open: boolean;
  title: string;
  value?: string;
  onClose: () => void;
  onChange: (time: string) => void;
}

export function TimePickerModal({
  open,
  title,
  value,
  onClose,
  onChange,
}: TimePickerModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!value) return;

    const [h, m] = value.split(":");

    setHour(Number(h));
    setMinute(Number(m));
  }, [value]);

  function handleApply() {
    const formatted =
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    onChange(formatted);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[1000] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="
              fixed
              left-1/2
              top-1/2
              z-[1001]
              w-[420px]
              max-w-[95vw]
              -translate-x-1/2
              -translate-y-1/2
              rounded-2xl
              border
              border-[var(--glass-border)]
              bg-[var(--bg-primary)]
              p-6
            "
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <h3 className="mb-2 text-xl font-semibold">
              {title}
            </h3>

            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Escolha um horário para esta atividade.
            </p>

            <div className="mb-6 text-center text-4xl font-bold">
              {String(hour).padStart(2, "0")}:
              {String(minute).padStart(2, "0")}
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Hora
                </h4>

                <ClockDial
                  value={hour}
                  max={24}
                  onChange={setHour}
                />
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Minutos
                </h4>

                <ClockDial
                  value={minute}
                  max={60}
                  onChange={setMinute}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2"
              >
                Cancelar
              </button>

              <button
                onClick={handleApply}
                className="
                  rounded-lg
                  bg-[var(--accent)]
                  px-5
                  py-2
                  text-white
                "
              >
                Aplicar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
