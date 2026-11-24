import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';

/**
 * Ambient focus sounds for mobile — rain + fireplace.
 * Mix persists in AsyncStorage (`energyos:ambient`), playback uses
 * expo-audio looped players. Assets in assets/sounds/ are the real
 * royalty-free loops shared with the web app (see public/sounds/CREDITS.md).
 */

export interface AmbientSoundDef {
  id: string;
  label: string;
  source: number; // require()'d asset
  defaultVolume: number;
}

export const AMBIENT_SOUNDS: readonly AmbientSoundDef[] = [
  { id: 'rain', label: 'Chuva', source: require('../../../assets/sounds/rain.mp3'), defaultVolume: 0.7 },
  { id: 'fireplace', label: 'Lareira', source: require('../../../assets/sounds/fireplace.mp3'), defaultVolume: 0.7 },
] as const;

export interface AmbientMix {
  enabled: string[];
  volumes: Record<string, number>;
  master: number;
  muted: boolean;
}

const LS_KEY = 'energyos:ambient';
const DEFAULT_MIX: AmbientMix = { enabled: [], volumes: {}, master: 0.4, muted: false };

export async function loadAmbientMix(): Promise<AmbientMix> {
  try {
    const raw = await AsyncStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_MIX;
    const p = JSON.parse(raw) as Partial<AmbientMix>;
    const enabled = Array.isArray(p.enabled)
      ? p.enabled.filter((id) => AMBIENT_SOUNDS.some((s) => s.id === id))
      : [];
    const volumes: Record<string, number> = {};
    if (p.volumes && typeof p.volumes === 'object') {
      for (const [k, v] of Object.entries(p.volumes)) {
        if (typeof v === 'number') volumes[k] = Math.min(1, Math.max(0, v));
      }
    }
    return {
      enabled,
      volumes,
      master: typeof p.master === 'number' ? Math.min(1, Math.max(0, p.master)) : DEFAULT_MIX.master,
      muted: p.muted === true,
    };
  } catch {
    return DEFAULT_MIX;
  }
}

async function saveAmbientMix(mix: AmbientMix) {
  try {
    await AsyncStorage.setItem(LS_KEY, JSON.stringify(mix));
  } catch { /* ignore */ }
}

// ---- Playback engine (module-level, survives re-renders) ----

const players = new Map<string, AudioPlayer>();
let currentMix: AmbientMix = DEFAULT_MIX;
let sessionActive = false;
let sessionPaused = false;
let fadingOut = false;
let sessionGen = 0;

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function effectiveVolume(id: string, mix: AmbientMix): number {
  const def = AMBIENT_SOUNDS.find((s) => s.id === id);
  if (!def) return 0;
  return clamp01((mix.volumes[id] ?? def.defaultVolume) * mix.master) * (mix.muted ? 0 : 1);
}

function shouldPlay(id: string): boolean {
  return sessionActive && !sessionPaused && currentMix.enabled.includes(id);
}

function ensurePlayer(id: string): AudioPlayer | null {
  const existing = players.get(id);
  if (existing) return existing;
  const def = AMBIENT_SOUNDS.find((s) => s.id === id);
  if (!def) return null;
  try {
    const player = createAudioPlayer(def.source);
    player.loop = true;
    players.set(id, player);
    return player;
  } catch {
    return null;
  }
}

/** Reconcile player state with session + mix. Call after any change. */
export function syncAmbientPlayback() {
  // During a quick fade-out the interval owns the volumes; don't let a
  // session-state flip pause the players mid-fade.
  if (fadingOut) return;
  const mix = currentMix;
  for (const def of AMBIENT_SOUNDS) {
    const player = players.get(def.id);
    const want = shouldPlay(def.id);
    if (!player) {
      if (want) {
        const p = ensurePlayer(def.id);
        if (p) {
          p.volume = effectiveVolume(def.id, mix);
          p.play();
        }
      }
      continue;
    }
    player.volume = effectiveVolume(def.id, mix);
    if (want && !player.playing) player.play();
    if (!want && player.playing) player.pause();
  }
  // Stop players for sounds no longer enabled to save battery.
  for (const [id, player] of players) {
    if (!mix.enabled.includes(id) && player.playing) player.pause();
  }
}

export function setAmbientSession(active: boolean, paused: boolean) {
  sessionActive = active;
  sessionPaused = paused;
  sessionGen += 1;
  syncAmbientPlayback();
}

export function updateAmbientMix(mix: AmbientMix) {
  currentMix = mix;
  syncAmbientPlayback();
}

/** Fade master volume to 0 quickly on give-up/cancel/completion, then pause. */
export function fadeOutAmbientQuick() {
  if (fadingOut) return;
  fadingOut = true;
  const gen = sessionGen;
  const mix = currentMix;
  const steps = 4;
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    const scale = Math.max(0, 1 - i / steps);
    for (const def of AMBIENT_SOUNDS) {
      const p = players.get(def.id);
      if (p) p.volume = effectiveVolume(def.id, mix) * scale;
    }
    if (i >= steps) {
      clearInterval(timer);
      fadingOut = false;
      // Only force-stop if no newer session state arrived mid-fade.
      if (sessionGen === gen) {
        sessionActive = false;
        sessionPaused = false;
      }
      syncAmbientPlayback();
    }
  }, 100);
}

export function useAmbientMix() {
  const [mix, setMix] = useState<AmbientMix>(DEFAULT_MIX);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadAmbientMix().then((m) => {
      if (cancelled) return;
      currentMix = m;
      setMix(m);
      setHydrated(true);
      syncAmbientPlayback();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((fn: (prev: AmbientMix) => AmbientMix) => {
    setMix((prev) => {
      const next = fn(prev);
      currentMix = next;
      void saveAmbientMix(next);
      syncAmbientPlayback();
      return next;
    });
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
    },
    [update],
  );

  const toggleMute = useCallback(() => {
    update((prev) => ({ ...prev, muted: !prev.muted }));
  }, [update]);

  return { mix, hydrated, toggleSound, toggleMute };
}
