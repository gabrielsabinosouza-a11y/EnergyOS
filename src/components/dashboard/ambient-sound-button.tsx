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
  const { mix, toggleSound, setSoundVolume, silence } = useAmbientMix();
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
      setPos({
        top: r.bottom + 8,
        right: Math.max(16, window.innerWidth - r.right),
      });
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

  const anyEnabled = mix.enabled.length > 0;

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
        {anyEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
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
                <div className="space-y-1">
                  {AMBIENT_SOUNDS.map((def) => {
                    const enabled = mix.enabled.includes(def.id);
                    const vol = mix.volumes[def.id] ?? def.defaultVolume;
                    return (
                      <div key={def.id}>
                        <div className="flex min-h-10 min-w-0 items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              primeAmbientAudio();
                              toggleSound(def.id);
                            }}
                            aria-pressed={enabled}
                            className={`flex min-w-0 flex-1 items-center gap-2 text-left text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                              enabled ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            <SoundIcon iconSrc={def.iconSrc} icon={def.icon} active={enabled} />
                            <span className="truncate">{def.label}</span>
                          </button>
                          {/* ON/OFF toggle */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${def.label}: ${enabled ? "ativado" : "desativado"}`}
                            onClick={() => {
                              primeAmbientAudio();
                              toggleSound(def.id);
                            }}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                              enabled ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                                enabled ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        {/* Volume slider — only while ON, animated open/close */}
                        <AnimatePresence initial={false}>
                          {enabled && (
                            <motion.div
                              key="vol"
                              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="flex min-w-0 items-center gap-2 pb-1.5 pl-8">
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={vol}
                                  onChange={(e) => setSoundVolume(def.id, Number(e.target.value))}
                                  className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
                                  aria-label={`Volume d${def.id === "rain" ? "a chuva" : "a lareira"}`}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      primeAmbientAudio();
                      silence();
                    }}
                    disabled={!anyEnabled}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <VolumeX size={11} />
                    Silenciar
                  </button>
                </div>
                {loadError && (
                  <p className="mt-2 text-[11px] text-amber-400/90">{loadError}</p>
                )}
                {!sessionActive && anyEnabled && (
                  <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                    Prévia de ~4s; o loop começa com a sessão.
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
