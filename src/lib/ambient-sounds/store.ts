"use client";

import { useCallback, useEffect, useState } from "react";
import { AMBIENT_SOUNDS, isAmbientSoundId } from "./config";
import { ambientEngine } from "./engine";

const LS_KEY = "energyos:ambient";

export interface AmbientMix {
  /** Selected sound ids (max AMBIENT_SOUNDS.length — keep it small). */
  enabled: string[];
  /** Per-sound volume 0..1. */
  volumes: Record<string, number>;
  /** Master volume 0..1 (default ~0.4). */
  master: number;
  muted: boolean;
}

export const DEFAULT_MIX: AmbientMix = {
  enabled: [],
  volumes: {},
  master: 0.4,
  muted: false,
};

export function readAmbientMix(): AmbientMix {
  if (typeof window === "undefined") return DEFAULT_MIX;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_MIX;
    const parsed = JSON.parse(raw) as Partial<AmbientMix>;
    const enabled = Array.isArray(parsed.enabled)
      ? parsed.enabled.filter((id) => typeof id === "string" && isAmbientSoundId(id))
      : [];
    const volumes: Record<string, number> = {};
    if (parsed.volumes && typeof parsed.volumes === "object") {
      for (const [k, v] of Object.entries(parsed.volumes)) {
        if (isAmbientSoundId(k) && typeof v === "number") {
          volumes[k] = Math.min(1, Math.max(0, v));
        }
      }
    }
    return {
      enabled,
      volumes,
      master: typeof parsed.master === "number" ? Math.min(1, Math.max(0, parsed.master)) : DEFAULT_MIX.master,
      muted: parsed.muted === true,
    };
  } catch {
    return DEFAULT_MIX;
  }
}

function writeAmbientMix(mix: AmbientMix) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(mix));
  } catch { /* ignore */ }
}

export function useAmbientMix() {
  const [mix, setMix] = useState<AmbientMix>(DEFAULT_MIX);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Defer the localStorage read so SSR markup matches; state update happens
    // in the async boot path (no synchronous setState in the effect body).
    const t = setTimeout(() => {
      setMix(readAmbientMix());
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const update = useCallback((fn: (prev: AmbientMix) => AmbientMix) => {
    setMix((prev) => {
      const next = fn(prev);
      writeAmbientMix(next);
      return next;
    });
    // Engine reads the persisted mix lazily, but nudge it for live updates.
    ambientEngine.updateMix();
  }, []);

  const toggleSound = useCallback(
    (id: string) => {
      update((prev) => {
        const has = prev.enabled.includes(id);
        const enabled = has
          ? prev.enabled.filter((x) => x !== id)
          : [...prev.enabled, id].slice(0, AMBIENT_SOUNDS.length);
        return { ...prev, enabled };
      });
      // Preview on enable when no session is running (handled inside engine).
      if (!mix.enabled.includes(id)) void ambientEngine.preview(id);
    },
    [mix.enabled, update],
  );

  const setSoundVolume = useCallback(
    (id: string, volume: number) => {
      update((prev) => ({ ...prev, volumes: { ...prev.volumes, [id]: volume } }));
    },
    [update],
  );

  const setMasterVolume = useCallback(
    (master: number) => update((prev) => ({ ...prev, master })),
    [update],
  );

  const setMuted = useCallback(
    (muted: boolean) => update((prev) => ({ ...prev, muted })),
    [update],
  );

  return { mix, hydrated, toggleSound, setSoundVolume, setMasterVolume, setMuted };
}
