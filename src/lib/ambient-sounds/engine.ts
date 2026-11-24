"use client";

import { AMBIENT_SOUNDS, AMBIENT_SOUND_BY_ID } from "./config";
import { readAmbientMix, type AmbientMix } from "./store";

/**
 * WebAudio ambient engine — gapless loops via AudioBufferSourceNode(loop=true)
 * into per-sound GainNodes → one master GainNode at a FIXED level (per-sound
 * sliders own loudness now; there is no user-facing master volume).
 * All fades use gain ramps so there are no clicks. Client-only; AudioContext
 * is created/resumed inside a user gesture (prime()) — never on page load.
 */

/** Fixed master level — preserves the previous ~40% loudness. */
const MASTER_LEVEL = 0.45;

const FADE_IN_MS = 1500;
const FADE_PAUSE_MS = 500;
const FADE_QUICK_MS = 400;
const FADE_SILENCE_MS = 300;
const FADE_FINISH_MS = 3000;
const PREVIEW_MS = 4000;

type Voice = { source: AudioBufferSourceNode; gain: GainNode };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const bufferPromises = new Map<string, Promise<AudioBuffer | null>>();
const voices = new Map<string, Voice>();
const failed = new Set<string>();
/** Sounds currently in preview mode (no session) with their fade timers. */
const previews = new Map<string, number>();

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

function effectiveMaster(): number {
  return MASTER_LEVEL;
}

/** Per-sound gain target (0..1 slider volume × fixed master lives on master node). */
function voiceGainFor(id: string, m: AmbientMix): number {
  const def = AMBIENT_SOUND_BY_ID.get(id);
  if (!def) return 0;
  return m.volumes[id] ?? def.defaultVolume;
}

function ramp(param: AudioParam, value: number, tc: number) {
  param.cancelScheduledValues(tc);
  param.setTargetAtTime(Math.max(0.0001, value), tc, 0.05);
}

function stopVoice(id: string, voice: Voice, delayMs: number) {
  window.setTimeout(() => {
    try { voice.source.stop(); } catch { /* already stopped */ }
    voice.source.disconnect();
    voice.gain.disconnect();
    if (voices.get(id) === voice) voices.delete(id);
  }, delayMs);
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

function anyAudible(m: AmbientMix): boolean {
  return m.enabled.length > 0 || previews.size > 0;
}

async function syncSessionSounds(fadeMs: number) {
  if (!ctx || !master) return;
  const m = mix ?? readAmbientMix();
  mix = m;
  const tc = ctx.currentTime;
  const activeIds = AMBIENT_SOUNDS.filter((s) => m.enabled.includes(s.id)).map((s) => s.id);

  // Fade out voices for sounds no longer selected.
  for (const [id, voice] of voices) {
    if (!activeIds.includes(id) && !previews.has(id)) {
      ramp(voice.gain.gain, 0.0001, tc);
      stopVoice(id, voice, fadeMs + 300);
    }
  }
  if (!sessionRunning || !gestureArmed || !anyAudible(m)) {
    ramp(master.gain, 0.0001, tc);
    return;
  }
  ramp(master.gain, Math.max(0.0001, effectiveMaster()), tc);
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

  /** "Silenciar": fast ~0.3s fade, keeps volumes for re-enable. */
  fadeOut(ms: number = FADE_SILENCE_MS) {
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
      if (ctx?.state === "running" && !sessionRunning) {
        for (const [id, voice] of voices) {
          try { voice.source.stop(); } catch { /* noop */ }
          voice.source.disconnect();
          voice.gain.disconnect();
          voices.delete(id);
        }
        previews.clear();
      }
    }, ms + 400);
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
    previews.clear();
  },

  /** Mix changed — apply live. Accepts the fresh mix object directly so the
   *  engine never races React's deferred state updater / localStorage. */
  updateMix(next?: AmbientMix) {
    mix = next ?? readAmbientMix();
    if (!ctx || !master) return;
    const m = mix;
    const tc = ctx.currentTime;
    const audible = sessionRunning || previews.size > 0;
    ramp(master.gain, audible ? Math.max(0.0001, effectiveMaster()) : 0.0001, tc);
    for (const [id, voice] of voices) {
      const live =
        (sessionRunning && m.enabled.includes(id)) || previews.has(id);
      // Short ~80ms ramp: live slider changes without zipper noise.
      voice.gain.gain.cancelScheduledValues(tc);
      voice.gain.gain.setTargetAtTime(
        live ? Math.max(0.0001, voiceGainFor(id, m)) : 0.0001,
        tc,
        0.08,
      );
    }
    if (sessionRunning) void syncSessionSounds(FADE_PAUSE_MS);
  },

  /** Short preview when no session is running, then fades out. Slider moves
   *  during preview re-ramp the SAME voice (no restart, no click) and extend
   *  the preview window slightly. */
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
    // Extend/reset the preview window — the source keeps playing, only the
    // gain is re-ramped, so there is no click or restart.
    const prevTimer = previews.get(id);
    if (prevTimer !== undefined) window.clearTimeout(prevTimer);
    const tc = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(tc);
    voice.gain.gain.setTargetAtTime(Math.max(0.0001, voiceGainFor(id, m)), tc, 0.08);
    master!.gain.cancelScheduledValues(tc);
    master!.gain.setTargetAtTime(Math.max(0.0001, effectiveMaster()), tc, 0.08);
    previews.set(id, window.setTimeout(() => {
      previews.delete(id);
      if (!sessionRunning && voices.get(id) === voice) {
        ramp(voice.gain.gain, 0.0001, ctx!.currentTime);
        // Fade master only if nothing else is audible.
        const stillPreviews = [...previews.keys()].length > 0;
        if (!stillPreviews) master!.gain.setTargetAtTime(0.0001, ctx!.currentTime, 0.1);
        window.setTimeout(() => {
          try { voice.source.stop(); } catch { /* noop */ }
          voice.source.disconnect();
          voice.gain.disconnect();
          voices.delete(id);
        }, 500);
      }
    }, PREVIEW_MS) as unknown as number);
  },
};

// Only one tab should play. Primary mechanism: BroadcastChannel. Fallback for
// Safari < 15.4 (no BroadcastChannel): a localStorage "owner" key + storage
// events — the most recent claimant keeps playing, older tabs fade out.
// If the playing tab closes, no other tab restarts by itself.
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
const OWNER_KEY = "energyos:ambient-owner";

function claimPlayback() {
  try {
    localStorage.setItem(OWNER_KEY, `${TAB_ID}:${Date.now()}`);
  } catch { /* storage unavailable — degrade silently */ }
}

function isForeignClaim(raw: string | null): boolean {
  if (!raw) return false;
  const [id, ts] = raw.split(":");
  return id !== TAB_ID && Number(ts) > 0;
}

if (typeof window !== "undefined") {
  if ("BroadcastChannel" in window) {
    const ch = new BroadcastChannel("energyos-ambient");
    ch.onmessage = (e) => {
      if (e.data === "claim") ambientEngine.fadeOut(FADE_QUICK_MS);
    };
    const origSetRunning = ambientEngine.setSessionRunning.bind(ambientEngine);
    ambientEngine.setSessionRunning = (running: boolean) => {
      if (running) {
        claimPlayback();
        ch.postMessage("claim");
      }
      origSetRunning(running);
    };
  } else if (typeof (window as Window).addEventListener === "function") {
    (window as Window).addEventListener("storage", (e) => {
      const se = e as StorageEvent;
      if (se.key === OWNER_KEY && isForeignClaim(se.newValue)) {
        ambientEngine.fadeOut(FADE_QUICK_MS);
      }
    });
    const origSetRunning = ambientEngine.setSessionRunning.bind(ambientEngine);
    ambientEngine.setSessionRunning = (running: boolean) => {
      if (running) claimPlayback();
      origSetRunning(running);
    };
  }
}
