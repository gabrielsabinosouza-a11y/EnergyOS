"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { AMBIENT_SOUNDS, AMBIENT_SOUND_BY_ID } from "@/lib/ambient-sounds/config";
import { useAmbientMix } from "@/lib/ambient-sounds/store";
import { getAmbientLoadError, onAmbientError, primeAmbientAudio } from "@/lib/ambient-sounds/engine";

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] text-[var(--text-muted)]">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
        aria-label={label}
      />
    </label>
  );
}

/**
 * Compact sound control for the focus card header. Button toggles a popover
 * with per-sound toggles/volume + master volume + mute. Opt-in only — audio
 * is primed inside user gestures, never on page load.
 */
export function AmbientSoundButton({ sessionActive }: { sessionActive: boolean }) {
  const { mix, toggleSound, setSoundVolume, setMasterVolume, setMuted } = useAmbientMix();
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => onAmbientError(() => setLoadError(getAmbientLoadError())), []);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anyEnabled = mix.enabled.length > 0 && !mix.muted;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          primeAmbientAudio();
          setOpen((o) => !o);
        }}
        aria-label={anyEnabled ? "Sons ambiente ativados" : "Sons ambiente"}
        aria-pressed={anyEnabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          anyEnabled
            ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text)]"
        }`}
      >
        {mix.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        Som
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Sons ambiente"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-xl backdrop-blur-md"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Sons ambiente{sessionActive ? "" : " — prévia"}
            </p>
            <div className="space-y-2.5">
              {AMBIENT_SOUNDS.map((def) => {
                const Icon = def.icon;
                const enabled = mix.enabled.includes(def.id);
                return (
                  <div key={def.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          primeAmbientAudio();
                          toggleSound(def.id);
                        }}
                        aria-pressed={enabled}
                        className={`flex items-center gap-1.5 text-[11px] transition ${
                          enabled ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        <Icon size={13} className={enabled ? "text-[var(--accent)]" : ""} />
                        {def.label}
                      </button>
                      {enabled && (
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={mix.volumes[def.id] ?? def.defaultVolume}
                          onChange={(e) => setSoundVolume(def.id, Number(e.target.value))}
                          className="h-1 w-16 cursor-pointer accent-[var(--accent)]"
                          aria-label={`Volume de ${def.label}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
              <VolumeSlider
                label="Volume geral"
                value={mix.master}
                onChange={setMasterVolume}
              />
              <button
                type="button"
                onClick={() => {
                  primeAmbientAudio();
                  setMuted(!mix.muted);
                }}
                aria-pressed={mix.muted}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-[10px] text-[var(--text-muted)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {mix.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                {mix.muted ? "Ativar som" : "Silenciar"}
              </button>
            </div>
            {loadError && (
              <p className="mt-2 text-[9px] text-amber-400/80">{loadError}</p>
            )}
            {!sessionActive && mix.enabled.length > 0 && (
              <p className="mt-2 text-[9px] text-[var(--text-faint)]">
                A prévia toca por alguns segundos; o loop começa com a sessão.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
