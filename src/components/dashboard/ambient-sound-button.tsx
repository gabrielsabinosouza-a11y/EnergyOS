"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { AMBIENT_SOUNDS } from "@/lib/ambient-sounds/config";
import { useAmbientMix } from "@/lib/ambient-sounds/store";
import { getAmbientLoadError, onAmbientError, primeAmbientAudio } from "@/lib/ambient-sounds/engine";

const POPOVER_WIDTH = 260;

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
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-[4.5rem] shrink-0 truncate text-[10px] text-[var(--text-muted)]">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
        aria-label={label}
      />
    </div>
  );
}

function SoundIcon({ iconSrc, icon: FallbackIcon, active }: { iconSrc?: string; icon: LucideIcon; active: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (iconSrc && !imgFailed) {
    return (
      <Image
        src={iconSrc}
        alt=""
        width={24}
        height={24}
        unoptimized
        onError={() => setImgFailed(true)}
        className="h-6 w-6 shrink-0 object-contain"
      />
    );
  }
  return <FallbackIcon size={14} className={active ? "text-[var(--accent)]" : ""} />;
}

/**
 * Compact sound control for the focus card header. The popover is rendered
 * through a portal (positioned from the button's bounding rect) so the card's
 * `overflow-hidden` + `isolate` stacking context can never clip it or let the
 * ring/aura paint over it.
 */
export function AmbientSoundButton({ sessionActive }: { sessionActive: boolean }) {
  const { mix, toggleSound, setSoundVolume, setMasterVolume, setMuted } = useAmbientMix();
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => onAmbientError(() => setLoadError(getAmbientLoadError())), []);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Measure the button and position the portaled popover under it.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const el = buttonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const right = Math.max(16, window.innerWidth - r.right);
      const top = r.bottom + 8;
      setPos({ top, right });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Close on outside click / Escape; return focus to the button.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Move focus into the popover when it opens.
  useEffect(() => {
    if (open) popRef.current?.querySelector<HTMLElement>("button, input")?.focus();
  }, [open]);

  // Close when a session starts — the popover would sit over the timer.
  const wasActive = useRef(sessionActive);
  useEffect(() => {
    if (sessionActive && !wasActive.current && open) close(false);
    wasActive.current = sessionActive;
  }, [sessionActive, open, close]);

  const anyEnabled = mix.enabled.length > 0 && !mix.muted;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
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

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={popRef}
                role="dialog"
                aria-label="Sons ambiente"
                initial={reducedMotion ? false : { opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  right: pos.right,
                  width: POPOVER_WIDTH,
                  maxWidth: "calc(100vw - 32px)",
                  zIndex: 100,
                }}
                className="rounded-xl border border-[var(--border-subtle)] p-3 shadow-2xl backdrop-blur-md"
              >
                {/* Near-opaque surface: --bg-surface is only ~78% alpha, so we
                    composite it over the page bg to stay readable on the aura. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-xl"
                  style={{
                    background: "color-mix(in srgb, var(--bg-surface) 96%, var(--bg-base, #000))",
                  }}
                />
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                  Sons ambiente{sessionActive ? "" : " — prévia"}
                </p>
                <div className="space-y-2.5">
                  {AMBIENT_SOUNDS.map((def) => {
                    const enabled = mix.enabled.includes(def.id);
                    return (
                      <div key={def.id} className="space-y-1.5">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              primeAmbientAudio();
                              toggleSound(def.id);
                            }}
                            aria-pressed={enabled}
                            className={`flex min-w-0 items-center gap-1.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                              enabled ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            <SoundIcon iconSrc={def.iconSrc} icon={def.icon} active={enabled} />
                            <span className="truncate">{def.label}</span>
                          </button>
                        </div>
                        {enabled && (
                          <VolumeSlider
                            label="Volume"
                            value={mix.volumes[def.id] ?? def.defaultVolume}
                            onChange={(v) => setSoundVolume(def.id, v)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 space-y-2.5 border-t border-[var(--border-subtle)] pt-3">
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
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
