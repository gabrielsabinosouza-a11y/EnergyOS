"use client";

import { AMBIENT_SOUNDS, AMBIENT_SOUND_BY_ID } from "./config";
import { readAmbientMix, type AmbientMix } from "./store";

/**
 * WebAudio ambient engine — gapless loops via AudioBufferSourceNode(loop=true)
 * into per-sound GainNodes → one master GainNode. All fades use gain ramps so
 * there are no clicks. Client-only; AudioContext is created/resumed inside a
 * user gesture (prime()) — never on page load.
 */

type Voice = { source: AudioBufferSourceNode; gain: GainNode };

const FADE_IN_MS = 1500;
const FADE_PAUSE_MS = 500;
const FADE_QUICK_MS = 400;
const FADE_FINISH_MS = 3000;
const PREVIEW_MS = 4000;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const bufferPromises = new Map<string, Promise<AudioBuffer | null>>();
const voices = new Map<string, Voice>();
const failed = new Set<string>();

let sessionRunning = false;
let mix: AmbientMix | null = null;
let gestureArmed = false;
let resumeListenerArmed = false;
let loadError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
export function onAmbientError(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getAmbientLoadError() {
  return loadError;
}

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/** Create/resume the context. MUST be called inside a user gesture. */
export function primeAmbientAudio(): void {
  const Ctor = audioCtor();
  if (!Ctor) return;
  try {
    if (!ctx) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    gestureArmed = true;
    armGestureResume();
  } catch { /* audio unsupported */ }
}

/** One-shot listener: after a page reload, the first user interaction resumes
 *  audio for an already-running session (autoplay policy requires a gesture). */
function armGestureResume() {
  if (resumeListenerArmed || typeof document === "undefined") return;
  resumeListenerArmed = true;
  const onGesture = () => {
    gestureArmed = true;
    // prime() creates/resumes the context — safe inside this gesture.
    primeAmbientAudio();
    if (sessionRunning) void syncSessionSounds(FADE_IN_MS);
    document.removeEventListener("pointerdown", onGesture);
    document.removeEventListener("keydown", onGesture);
    resumeListenerArmed = false;
  };
  document.addEventListener("pointerdown", onGesture);
  document.addEventListener("keydown", onGesture);
}

async function fetchBuffer(id: string): Promise<AudioBuffer | null> {
  const def = AMBIENT_SOUND_BY_ID.get(id);
  if (!def || !ctx) return null;
  if (buffers.has(id)) return buffers.get(id)!;
  const pending = bufferPromises.get(id);
  if (pending) return pending;
  const p = (async () => {
    try {
      for (const ext of ["ogg", "mp3"]) {
        try {
          const res = await fetch(`/sounds/${def.fileBase}.${ext}`);
          if (!res.ok) continue;
          const buf = await ctx!.decodeAudioData(await res.arrayBuffer());
          buffers.set(id, buf);
          return buf;
        } catch { /* try next ext */ }
      }
      failed.add(id);
      loadError = `Não foi possível carregar "${def.label}".`;
      emit();
      return null;
    } finally {
      bufferPromises.delete(id);
    }
  })();
  bufferPromises.set(id, p);
  return p;
}

function effectiveMaster(m: AmbientMix): number {
  return m.muted ? 0 : m.master;
}

function voiceGainFor(id: string, m: AmbientMix): number {
  const def = AMBIENT_SOUND_BY_ID.get(id);
  if (!def) return 0;
  return (m.volumes[id] ?? def.defaultVolume) * effectiveMaster(m);
}

function ramp(param: AudioParam, value: number, tc: number) {
  param.cancelScheduledValues(tc);
  param.setTargetAtTime(Math.max(0.0001, value), tc, 0.05);
}

async function ensureVoice(id: string): Promise<Voice | null> {
  if (!ctx || !master) return null;
  const existing = voices.get(id);
  if (existing) return existing;
  const buf = await fetchBuffer(id);
  if (!buf || !ctx || !master) return null;
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  source.connect(gain).connect(master);
  source.start();
  const voice = { source, gain };
  voices.set(id, voice);
  return voice;
}

async function syncSessionSounds(fadeMs: number) {
  if (!ctx || !master) return;
  const m = mix ?? readAmbientMix();
  mix = m;
  const tc = ctx.currentTime;
  const activeIds = AMBIENT_SOUNDS.filter((s) => m.enabled.includes(s.id)).map((s) => s.id);

  // Fade out voices for sounds no longer selected.
  for (const [id, voice] of voices) {
    if (!activeIds.includes(id)) {
      ramp(voice.gain.gain, 0.0001, tc);
      const src = voice.source;
      window.setTimeout(() => {
        try { src.stop(); } catch { /* already stopped */ }
        src.disconnect();
        voice.gain.disconnect();
        voices.delete(id);
      }, fadeMs + 300);
    }
  }
  if (!sessionRunning || !gestureArmed) {
    ramp(master.gain, 0.0001, tc);
    return;
  }
  ramp(master.gain, Math.max(0.0001, m.master), tc);
  for (const id of activeIds) {
    const voice = await ensureVoice(id);
    if (!voice) continue;
    // setTargetAtTime approximates a linear fade over ~fadeMs.
    voice.gain.gain.cancelScheduledValues(tc);
    voice.gain.gain.setTargetAtTime(Math.max(0.0001, voiceGainFor(id, m)), tc, fadeMs / 3000);
  }
}

export const ambientEngine = {
  /** Call inside the "Iniciar foco" gesture. */
  prime: primeAmbientAudio,

  /** Session state changed. running=true fades selected sounds in (~1.5s). */
  setSessionRunning(running: boolean) {
    sessionRunning = running;
    if (running) {
      mix = readAmbientMix();
      if (ctx?.state === "running" && gestureArmed) void syncSessionSounds(FADE_IN_MS);
      else armGestureResume();
    } else {
      this.fadeOut(FADE_QUICK_MS);
    }
  },

  /** Pause: fade out ~0.5s and suspend sources (resume fades back in). */
  setPaused(paused: boolean) {
    if (!ctx || !master) return;
    const m = mix ?? readAmbientMix();
    mix = m;
    const tc = ctx.currentTime;
    if (paused) {
      for (const voice of voices.values()) ramp(voice.gain.gain, 0.0001, tc);
      ramp(master.gain, 0.0001, tc);
    } else if (sessionRunning) {
      void syncSessionSounds(FADE_PAUSE_MS);
    }
  },

  /** Quick fade (~0.4s): grace-period cancel and give-up. No chime. */
  fadeOutQuick() {
    sessionRunning = false;
    this.fadeOut(FADE_QUICK_MS);
  },

  /** Slow fade (~3s) for successful completion — then silence (the existing
   *  completion chime plays on its own schedule). */
  fadeOutFinish() {
    sessionRunning = false;
    this.fadeOut(FADE_FINISH_MS);
  },

  /** Hard stop (page contexts where audio already died, e.g. reload). */
  stopAll() {
    sessionRunning = false;
    for (const [id, voice] of voices) {
      try { voice.source.stop(); } catch { /* noop */ }
      voice.source.disconnect();
      voice.gain.disconnect();
      voices.delete(id);
    }
  },

  fadeOut(ms: number) {
    if (!ctx || !master) return;
    const tc = ctx.currentTime;
    const tau = ms / 3000;
    for (const voice of voices.values()) {
      voice.gain.gain.cancelScheduledValues(tc);
      voice.gain.gain.setTargetAtTime(0.0001, tc, tau);
    }
    master.gain.cancelScheduledValues(tc);
    master.gain.setTargetAtTime(0.0001, tc, tau);
    window.setTimeout(() => {
      if (ctx?.state === "running") {
        for (const [id, voice] of voices) {
          try { voice.source.stop(); } catch { /* noop */ }
          voice.source.disconnect();
          voice.gain.disconnect();
          voices.delete(id);
        }
      }
    }, ms + 400);
  },

  /** Mix changed while idle or running — apply live. */
  updateMix() {
    mix = readAmbientMix();
    if (!ctx || !master) return;
    const m = mix;
    const tc = ctx.currentTime;
    ramp(master.gain, sessionRunning ? Math.max(0.0001, effectiveMaster(m)) : 0.0001, tc);
    for (const [id, voice] of voices) {
      const active = sessionRunning && m.enabled.includes(id);
      ramp(voice.gain.gain, active ? voiceGainFor(id, m) : 0.0001, tc);
    }
    if (sessionRunning) void syncSessionSounds(FADE_PAUSE_MS);
  },

  /** Short preview when no session is running, then fades out. */
  async preview(id: string) {
    if (sessionRunning) return;
    primeAmbientAudio();
    if (!ctx || ctx.state !== "running") return;
    mix = readAmbientMix();
    const m = mix;
    const def = AMBIENT_SOUND_BY_ID.get(id);
    if (!def) return;
    const voice = await ensureVoice(id);
    if (!voice) return;
    const tc = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(tc);
    voice.gain.gain.setTargetAtTime(Math.max(0.0001, voiceGainFor(id, m)), tc, 0.08);
    master!.gain.cancelScheduledValues(tc);
    master!.gain.setTargetAtTime(Math.max(0.0001, effectiveMaster(m)), tc, 0.08);
    window.setTimeout(() => {
      if (!sessionRunning && voices.get(id) === voice) {
        ramp(voice.gain.gain, 0.0001, ctx!.currentTime);
        master!.gain.setTargetAtTime(0.0001, ctx!.currentTime, 0.1);
        window.setTimeout(() => {
          try { voice.source.stop(); } catch { /* noop */ }
          voice.source.disconnect();
          voice.gain.disconnect();
          voices.delete(id);
        }, 500);
      }
    }, PREVIEW_MS);
  },
};

// Only one tab should play: if another tab already owns the channel, this
// tab's engine stays silent. (BroadcastChannel is best-effort; the per-tab
// AudioContext still only runs after a local user gesture.)
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  const ch = new BroadcastChannel("energyos-ambient");
  ch.onmessage = (e) => {
    if (e.data === "claim") ambientEngine.fadeOutQuick();
  };
  const origSetRunning = ambientEngine.setSessionRunning.bind(ambientEngine);
  ambientEngine.setSessionRunning = (running: boolean) => {
    if (running) ch.postMessage("claim");
    origSetRunning(running);
  };
}
