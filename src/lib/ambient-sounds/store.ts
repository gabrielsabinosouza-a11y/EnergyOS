"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AMBIENT_SOUNDS, isAmbientSoundId } from "./config";
import { ambientEngine } from "./engine";

const LS_KEY = "energyos:ambient";

/**
 * Persisted mix: which sounds are ON + each sound's volume (0..1).
 * The old shape had `master`/`muted` — those are migrated/ignored on read.
 */
export interface AmbientMix {
  enabled: string[];
  volumes: Record<string, number>;
  /** Sounds that were ON when "Silenciar" was pressed — restored by "Reativar". */
  lastEnabled?: string[];
}

export const DEFAULT_MIX: AmbientMix = { enabled: [], volumes: {} };

export function readAmbientMix(): AmbientMix {
  if (typeof window === "undefined") return DEFAULT_MIX;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_MIX;
    const parsed = JSON.parse(raw) as {
      enabled?: unknown;
      volumes?: unknown;
      muted?: unknown;
      lastEnabled?: unknown;
    };
    const enabled = Array.isArray(parsed.enabled)
      ? parsed.enabled.filter((id): id is string => typeof id === "string" && isAmbientSoundId(id))
      : [];
    const lastEnabled = Array.isArray(parsed.lastEnabled)
      ? parsed.lastEnabled.filter((id): id is string => typeof id === "string" && isAmbientSoundId(id))
      : [];
    const volumes: Record<string, number> = {};
    if (parsed.volumes && typeof parsed.volumes === "object") {
      for (const [k, v] of Object.entries(parsed.volumes as Record<string, unknown>)) {
        if (isAmbientSoundId(k) && typeof v === "number") {
          volumes[k] = Math.min(1, Math.max(0, v));
        }
      }
    }
    // Legacy migration: old `muted: true` meant "all sounds off" — keep the
    // volumes AND the previous selection as lastEnabled so "Reativar" works.
    // `master` is ignored entirely.
    if (parsed.muted === true) {
      return { enabled: [], volumes, lastEnabled: enabled.length ? enabled : lastEnabled };
    }
    const mix: AmbientMix = { enabled: enabled.slice(0, AMBIENT_SOUNDS.length), volumes };
    if (lastEnabled.length) mix.lastEnabled = lastEnabled.slice(0, AMBIENT_SOUNDS.length);
    return mix;
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
  // Synchronous mirror so engine updates never race React's deferred updater.
  const mixRef = useRef<AmbientMix>(DEFAULT_MIX);

  useEffect(() => {
    const t = setTimeout(() => {
      const m = readAmbientMix();
      mixRef.current = m;
      setMix(m);
      setHydrated(true);
      ambientEngine.updateMix(m);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const update = useCallback((fn: (prev: AmbientMix) => AmbientMix) => {
    // Compute + persist synchronously, THEN notify React and the engine with
    // the exact same object — no stale localStorage read possible.
    const next = fn(mixRef.current);
    mixRef.current = next;
    writeAmbientMix(next);
    setMix(next);
    ambientEngine.updateMix(next);
  }, []);

  const toggleSound = useCallback(
    (id: string) => {
      const wasEnabled = mixRef.current.enabled.includes(id);
      update((prev) => {
        const has = prev.enabled.includes(id);
        const enabled = has
          ? prev.enabled.filter((x) => x !== id)
          : [...prev.enabled, id].slice(0, AMBIENT_SOUNDS.length);
        // Manually turning EVERYTHING off cancels the pending "Reativar".
        return { ...prev, enabled, lastEnabled: enabled.length ? prev.lastEnabled : undefined };
      });
      // Turning ON outside a session plays a short preview (engine-side).
      if (!wasEnabled) void ambientEngine.preview(id);
    },
    [update],
  );

  const setSoundVolume = useCallback(
    (id: string, volume: number) => {
      update((prev) => ({
        ...prev,
        volumes: { ...prev.volumes, [id]: Math.min(1, Math.max(0, volume)) },
      }));
    },
    [update],
  );

  /** "Silenciar": turns every sound OFF (~0.3s fade, all sources stopped)
   *  but keeps per-sound volumes AND the previous selection so "Reativar"
   *  restores exactly what was playing. */
  const silence = useCallback(() => {
    update((prev) => ({
      ...prev,
      enabled: [],
      lastEnabled: prev.enabled.length ? prev.enabled : prev.lastEnabled,
    }));
    ambientEngine.silence();
  }, [update]);

  /** "Reativar": restores the sounds that were ON before Silenciar, with
   *  their saved volumes. Outside a session each one plays its ~4s preview. */
  const unsilence = useCallback(() => {
    const prev = mixRef.current;
    const restore = (prev.lastEnabled ?? []).filter((id) => isAmbientSoundId(id));
    if (!restore.length) return;
    update((p) => ({ ...p, enabled: restore.slice(0, AMBIENT_SOUNDS.length) }));
    if (!prev.enabled.length) {
      for (const id of restore) void ambientEngine.preview(id);
    }
  }, [update]);

  const muted = mix.enabled.length === 0 && (mix.lastEnabled?.length ?? 0) > 0;

  return { mix, hydrated, toggleSound, setSoundVolume, silence, unsilence, muted };
}
