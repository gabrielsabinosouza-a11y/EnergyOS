"use client";

import { AMBIENT_SOUNDS, AMBIENT_SOUND_BY_ID } from "./config";
import { readAmbientMix, type AmbientMix } from "./store";

/**
 * WebAudio ambient engine — ONE instance per browsing context, stored on
 * globalThis so Next.js Fast Refresh / Strict Mode can never spawn a second
 * engine with orphaned sources. Each sound owns ONE voice: a persistent
 * GainNode plus at most one live AudioBufferSourceNode (looped, gapless).
 * All fades use gain ramps — no clicks. AudioContext is created/resumed
 * inside a user gesture (prime()) — never on page load.
 */

/** Fixed master level — preserves the previous ~40% loudness. */
const MASTER_LEVEL = 0.45;

const FADE_IN_MS = 1500;
const FADE_OUT_MS = 500;    // toggle OFF during session
const FADE_QUICK_MS = 400;  // grace-cancel / give-up
const FADE_SILENCE_MS = 300;
const FADE_FINISH_MS = 3000;
const PREVIEW_MS = 4000;
const LIVE_RAMP_TC = 0.08;  // ~80ms — slider changes without zipper noise

interface Voice {
  id: string;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  /** Pending stop() scheduled by a fade-out — cancelled if re-enabled. */
  stopTimer?: ReturnType<typeof setTimeout>;
}

interface Preview {
  voice: Voice;
  timer: ReturnType<typeof setTimeout>;
}

class AmbientEngineImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private bufferPromises = new Map<string, Promise<AudioBuffer | null>>();
  /** Per-sound persistent voice: gain node + at most one live source. */
  private voices = new Map<string, Voice>();
  private previews = new Map<string, Preview>();
  private failed = new Set<string>();
  private sessionRunning = false;
  private mix: AmbientMix | null = null;
  private gestureArmed = false;
  private resumeListenerArmed = false;
  private loadError: string | null = null;
  private listeners = new Set<() => void>();

  onError(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  getLoadError(): string | null {
    return this.loadError;
  }

  /** Dev/test diagnostic: live source count per sound id (0/1 each). */
  debugActiveSources(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, v] of this.voices) out[id] = v.source ? 1 : 0;
    return out;
  }

  /** Dev/test diagnostic: last-ramped gain value per sound id. */
  debugGainValues(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, v] of this.voices) out[id] = v.gain.gain.value;
    return out;
  }

  /** Test-only: drop all state so each test starts clean. */
  resetForTests() {
    this.stopAll();
    this.voices.clear();
    this.buffers.clear();
    this.bufferPromises.clear();
    this.failed.clear();
    this.loadError = null;
    this.sessionRunning = false;
    this.mix = null;
    this.gestureArmed = false;
  }

  /* ---------------- context ---------------- */

  private audioCtor(): typeof AudioContext | null {
    if (typeof window === "undefined") return null;
    return (
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      null
    );
  }

  /** Create/resume the context. MUST be called inside a user gesture. */
  prime(): void {
    const Ctor = this.audioCtor();
    if (!Ctor) return;
    try {
      if (!this.ctx) {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
        // Voice gain nodes may belong to a previous (closed) context —
        // re-connect them all to the new master.
        for (const v of this.voices.values()) {
          try { v.gain.disconnect(); } catch { /* noop */ }
          v.gain.connect(this.master);
        }
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.gestureArmed = true;
      this.armGestureResume();
    } catch { /* audio unsupported */ }
  }

  /** After a reload, the first user interaction resumes audio for an
   *  already-running session (autoplay policy requires a gesture). */
  private armGestureResume() {
    if (this.resumeListenerArmed || typeof document === "undefined") return;
    this.resumeListenerArmed = true;
    const onGesture = () => {
      this.gestureArmed = true;
      this.prime();
      if (this.sessionRunning) void this.syncSessionSounds(FADE_IN_MS);
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("keydown", onGesture);
      this.resumeListenerArmed = false;
    };
    document.addEventListener("pointerdown", onGesture);
    document.addEventListener("keydown", onGesture);
  }

  /* ---------------- buffers ---------------- */

  private async fetchBuffer(id: string): Promise<AudioBuffer | null> {
    const def = AMBIENT_SOUND_BY_ID.get(id);
    if (!def || !this.ctx) return null;
    if (this.buffers.has(id)) return this.buffers.get(id)!;
    const pending = this.bufferPromises.get(id);
    if (pending) return pending;
    const p = (async () => {
      try {
        for (const ext of ["ogg", "mp3"]) {
          try {
            const res = await fetch(`/sounds/${def.fileBase}.${ext}`);
            if (!res.ok) continue;
            const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
            this.buffers.set(id, buf);
            return buf;
          } catch { /* try next ext */ }
        }
        this.failed.add(id);
        this.loadError = `Não foi possível carregar "${def.label}".`;
        this.emit();
        return null;
      } finally {
        this.bufferPromises.delete(id);
      }
    })();
    this.bufferPromises.set(id, p);
    return p;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /* ---------------- voices ---------------- */

  private getOrCreateVoice(id: string): Voice | null {
    if (!this.ctx || !this.master) return null;
    let voice = this.voices.get(id);
    if (!voice) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(this.master);
      voice = { id, gain, source: null };
      this.voices.set(id, voice);
    }
    return voice;
  }

  /** Ensure the voice has a LIVE source. A stopped AudioBufferSourceNode can
   *  never restart — always create a fresh one and clean the old via onended. */
  private async ensureSource(id: string): Promise<Voice | null> {
    const voice = this.getOrCreateVoice(id);
    if (!voice || !this.ctx) return null;
    if (voice.source) {
      // A fade-out may have scheduled stop() — cancel it and keep playing.
      if (voice.stopTimer !== undefined) {
        clearTimeout(voice.stopTimer);
        voice.stopTimer = undefined;
      }
      return voice;
    }
    const buf = await this.fetchBuffer(id);
    if (!buf || !this.ctx || !this.master) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    source.connect(voice.gain);
    const v = voice;
    source.onended = () => {
      // Only clear if this exact source is still the tracked one.
      if (v.source === source) v.source = null;
    };
    voice.source = source;
    source.start();
    return voice;
  }

  /** Fade a sound's gain to 0, then stop+disconnect its source after `delayMs`. */
  private fadeOutVoice(id: string, delayMs: number) {
    const voice = this.voices.get(id);
    if (!voice || !this.ctx) return;
    const tc = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(tc);
    voice.gain.gain.setTargetAtTime(0.0001, tc, delayMs / 3000);
    const src = voice.source;
    if (src) {
      if (voice.stopTimer !== undefined) clearTimeout(voice.stopTimer);
      voice.stopTimer = setTimeout(() => {
        voice.stopTimer = undefined;
        try { src.stop(); } catch { /* already stopped */ }
        src.disconnect();
        if (voice.source === src) voice.source = null;
      }, delayMs + 200);
    }
  }

  private ramp(param: AudioParam, value: number, tc: number) {
    param.cancelScheduledValues(tc);
    param.setTargetAtTime(Math.max(0.0001, value), tc, 0.05);
  }

  private voiceGainFor(id: string, m: AmbientMix): number {
    const def = AMBIENT_SOUND_BY_ID.get(id);
    if (!def) return 0;
    return m.volumes[id] ?? def.defaultVolume;
  }

  private audible(m: AmbientMix): boolean {
    return this.sessionRunning
      ? m.enabled.length > 0 || this.previews.size > 0
      : this.previews.size > 0;
  }

  /* ---------------- session lifecycle ---------------- */

  setSessionRunning(running: boolean) {
    this.sessionRunning = running;
    if (running) {
      this.mix = readAmbientMix();
      this.prime(); // session start is always a user gesture
      if (this.ctx?.state === "running" && this.gestureArmed) void this.syncSessionSounds(FADE_IN_MS);
      else this.armGestureResume();
    } else {
      this.fadeOut(FADE_QUICK_MS);
    }
  }

  setPaused(paused: boolean) {
    if (!this.ctx || !this.master) return;
    const m = this.mix ?? readAmbientMix();
    this.mix = m;
    const tc = this.ctx.currentTime;
    if (paused) {
      for (const voice of this.voices.values()) this.ramp(voice.gain.gain, 0.0001, tc);
      this.ramp(this.master.gain, 0.0001, tc);
    } else if (this.sessionRunning) {
      void this.syncSessionSounds(FADE_OUT_MS);
    }
  }

  /** Grace-cancel / give-up: quick fade, no chime. */
  fadeOutQuick() {
    this.sessionRunning = false;
    this.fadeOut(FADE_QUICK_MS);
  }

  /** "Silenciar": fast fade, then stop ALL tracked sources; saved volumes
   *  are kept so re-enabling restores the last level. The AudioContext stays
   *  alive so sounds can be re-enabled mid-session. */
  silence() {
    this.clearPreviews();
    this.mix = { enabled: [], volumes: readAmbientMix().volumes };
    this.fadeOut(FADE_SILENCE_MS);
    window.setTimeout(() => this.stopSources(), FADE_SILENCE_MS + 500);
  }

  /** Slow fade (~3s) for successful completion — then silence. */
  fadeOutFinish() {
    this.sessionRunning = false;
    this.fadeOut(FADE_FINISH_MS);
  }

  /** Immediate fade to silence + stop everything (unmount, tab claim loss). */
  stopAll() {
    this.sessionRunning = false;
    this.clearPreviews();
    this.fadeOut(FADE_QUICK_MS);
    this.stopAllSources();
  }

  private clearPreviews() {
    for (const p of this.previews.values()) clearTimeout(p.timer);
    this.previews.clear();
  }

  /** Stop + disconnect every tracked source (context stays alive). */
  private stopSources() {
    for (const voice of this.voices.values()) {
      if (voice.stopTimer !== undefined) {
        clearTimeout(voice.stopTimer);
        voice.stopTimer = undefined;
      }
      const src = voice.source;
      if (src) {
        try { src.stop(); } catch { /* noop */ }
        src.disconnect();
        if (voice.source === src) voice.source = null;
      }
    }
  }

  /** Last resort: stop everything AND close the context. */
  private stopAllSources() {
    this.stopSources();
    if (this.ctx) {
      void this.ctx.close().catch(() => { /* already closed */ });
      this.ctx = null;
      this.master = null;
      this.gestureArmed = false;
    }
  }

  fadeOut(ms = FADE_QUICK_MS) {
    if (!this.ctx || !this.master) return;
    const tc = this.ctx.currentTime;
    const tau = ms / 3000;
    for (const voice of this.voices.values()) {
      voice.gain.gain.cancelScheduledValues(tc);
      voice.gain.gain.setTargetAtTime(0.0001, tc, tau);
    }
    this.master.gain.cancelScheduledValues(tc);
    this.master.gain.setTargetAtTime(0.0001, tc, tau);
    window.setTimeout(() => {
      // Safety net: if anything is still sounding after the fade, hard-stop.
      if (!this.sessionRunning) this.stopStragglers();
    }, ms + 400);
  }

  /** Dev-only diagnostic: any source still flagged live after a stop gets
   *  force-stopped; in dev we also log it. */
  private stopStragglers() {
    let leaked = 0;
    for (const voice of this.voices.values()) {
      if (voice.source) {
        leaked++;
        try { voice.source.stop(); } catch { /* noop */ }
        voice.source.disconnect();
        voice.source = null;
      }
    }
    if (leaked > 0 && process.env.NODE_ENV !== "production") {
      console.error(`[ambient] ${leaked} source(s) were still live after fade — force-stopped`);
    }
  }

  /* ---------------- mix / preview ---------------- */

  /** Mix changed — apply live. Takes the fresh mix object directly so the
   *  engine never races React's deferred updater / localStorage. */
  updateMix(next?: AmbientMix) {
    this.mix = next ?? readAmbientMix();
    if (!this.ctx || !this.master) return;
    const m = this.mix;
    const tc = this.ctx.currentTime;
    const audible = this.audible(m);
    this.ramp(this.master.gain, audible ? Math.max(0.0001, MASTER_LEVEL) : 0.0001, tc);
    for (const [id, voice] of this.voices) {
      const live =
        (this.sessionRunning && m.enabled.includes(id)) || this.previews.has(id);
      voice.gain.gain.cancelScheduledValues(tc);
      voice.gain.gain.setTargetAtTime(
        live ? Math.max(0.0001, this.voiceGainFor(id, m)) : 0.0001,
        tc,
        LIVE_RAMP_TC,
      );
    }
    // A preview whose sound was toggled OFF must end — otherwise the
    // previews map keeps the master gain alive with nothing enabled.
    if (!this.sessionRunning) {
      for (const [id, p] of [...this.previews]) {
        if (!m.enabled.includes(id)) {
          clearTimeout(p.timer);
          this.previews.delete(id);
          this.fadeOutVoice(id, FADE_OUT_MS);
        }
      }
    }
    if (this.sessionRunning) void this.syncSessionSounds(FADE_OUT_MS);
  }

  private async syncSessionSounds(fadeMs: number) {
    if (!this.ctx || !this.master) return;
    const m = this.mix ?? readAmbientMix();
    this.mix = m;
    const tc = this.ctx.currentTime;
    const activeIds = AMBIENT_SOUNDS.filter((s) => m.enabled.includes(s.id)).map((s) => s.id);

    // Sounds turned OFF (and not previewing) fade out then stop.
    for (const id of AMBIENT_SOUND_BY_ID.keys()) {
      if (!activeIds.includes(id) && !this.previews.has(id)) {
        this.fadeOutVoice(id, fadeMs);
      }
    }
    if (!this.sessionRunning || !this.gestureArmed || !this.audible(m)) {
      this.ramp(this.master.gain, 0.0001, tc);
      return;
    }
    this.ramp(this.master.gain, Math.max(0.0001, MASTER_LEVEL), tc);
    for (const id of activeIds) {
      const voice = await this.ensureSource(id);
      if (!voice) continue;
      voice.gain.gain.cancelScheduledValues(tc);
      voice.gain.gain.setTargetAtTime(
        Math.max(0.0001, this.voiceGainFor(id, m)),
        tc,
        fadeMs / 3000,
      );
    }
  }

  /** Short preview when no session is running (~4s), then fades out. Slider
   *  moves during preview re-ramp the SAME voice and extend the window —
   *  no restart, no click. */
  async preview(id: string) {
    if (this.sessionRunning) return;
    this.prime();
    if (!this.ctx || this.ctx.state !== "running") return;
    this.mix = readAmbientMix();
    const m = this.mix;
    if (!AMBIENT_SOUND_BY_ID.has(id)) return;
    const voice = await this.ensureSource(id);
    if (!voice) return;
    // Extend/reset the preview window — source keeps playing, only gain ramps.
    const prev = this.previews.get(id);
    if (prev) clearTimeout(prev.timer);
    const tc = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(tc);
    voice.gain.gain.setTargetAtTime(
      Math.max(0.0001, this.voiceGainFor(id, m)),
      tc,
      LIVE_RAMP_TC,
    );
    this.master!.gain.cancelScheduledValues(tc);
    this.master!.gain.setTargetAtTime(Math.max(0.0001, MASTER_LEVEL), tc, LIVE_RAMP_TC);
    const timer = setTimeout(() => {
      this.previews.delete(id);
      if (!this.sessionRunning && voice.source) {
        this.fadeOutVoice(id, FADE_OUT_MS);
        if (this.previews.size === 0) {
          this.master!.gain.setTargetAtTime(0.0001, this.ctx!.currentTime, 0.1);
        }
      }
    }, PREVIEW_MS);
    this.previews.set(id, { voice, timer });
  }

  /* ---------------- Media Session API (lock screen) ---------------- */

  /** Update the browser MediaSession while a focus session runs so the
   *  system can show play/pause/stop controls and correct playback state.
   *  Feature-detected: browsers without MediaSession get a silent no-op. */
  syncMediaSession(sessionRunning: boolean, playing: boolean) {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    if (typeof MediaMetadata !== "undefined") {
      try {
        ms.metadata = new MediaMetadata({
          title: sessionRunning ? "Foco — sessão em andamento" : "EnergyOS",
          artist: "EnergyOS",
          album: "Som ambiente",
        });
      } catch { /* some browsers reject metadata assignment — fine */ }
    }
    try {
      ms.playbackState = sessionRunning ? (playing ? "playing" : "paused") : "none";
    } catch { /* noop */ }
    if (sessionRunning) {
      ms.setActionHandler("play", () => this.setPaused(false));
      ms.setActionHandler("pause", () => this.setPaused(true));
      ms.setActionHandler("stop", () => this.fadeOutQuick());
    } else {
      this.clearMediaSession();
    }
  }

  /** Remove MediaSession action handlers — call on unmount/session end. */
  clearMediaSession() {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    for (const action of ["play", "pause", "stop"] as const) {
      try { ms.setActionHandler(action, null); } catch { /* noop */ }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Singleton on globalThis — HMR / Strict Mode re-evaluation returns */
/*  the SAME engine, so sources can never be orphaned by a second     */
/*  instance.                                                         */
/* ------------------------------------------------------------------ */

const GLOBAL_KEY = "__energyosAmbientEngine";
const g = globalThis as Record<string, unknown>;
if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = new AmbientEngineImpl();
}
export const ambientEngine = g[GLOBAL_KEY] as AmbientEngineImpl;

// Module reload (HMR): keep the singleton — its voices stay tracked and
// controllable. If a bundler disposes the module, stop everything cleanly.
if (typeof module !== "undefined" && typeof (module as { hot?: unknown }).hot !== "undefined") {
  (module as unknown as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    ambientEngine.stopAll();
  });
}

/* ------------------------------------------------------------------ */
/*  Multi-tab: only one tab plays. BroadcastChannel primary;           */
/*  localStorage owner-key + storage events fallback (Safari <15.4).   */
/* ------------------------------------------------------------------ */

const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
const OWNER_KEY = "energyos:ambient-owner";

function claimPlayback() {
  try {
    localStorage.setItem(OWNER_KEY, `${TAB_ID}:${Date.now()}`);
  } catch { /* degrade silently */ }
}

function isForeignClaim(raw: string | null): boolean {
  if (!raw) return false;
  const [id, ts] = raw.split(":");
  return id !== TAB_ID && Number(ts) > 0;
}

if (typeof window !== "undefined") {
  const eng = ambientEngine as unknown as {
    setSessionRunning: (r: boolean) => void;
    fadeOut: (ms?: number) => void;
    stopAll: () => void;
    __tabWrapped?: boolean;
  };
  if (!eng.__tabWrapped) {
    eng.__tabWrapped = true;
    const orig = eng.setSessionRunning.bind(eng);
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("energyos-ambient");
      ch.onmessage = () => eng.fadeOut(FADE_QUICK_MS);
      eng.setSessionRunning = (running: boolean) => {
        if (running) {
          claimPlayback();
          ch.postMessage("claim");
        }
        orig(running);
      };
    } else if (typeof (window as Window).addEventListener === "function") {
      (window as Window).addEventListener("storage", (e) => {
        const se = e as StorageEvent;
        if (se.key === OWNER_KEY && isForeignClaim(se.newValue)) eng.fadeOut(FADE_QUICK_MS);
      });
      eng.setSessionRunning = (running: boolean) => {
        if (running) claimPlayback();
        orig(running);
      };
    }
  }
}

/* ---------------- public helpers (component API) ---------------- */

/** Call inside a user gesture before starting audio. */
export function primeAmbientAudio(): void {
  ambientEngine.prime();
}

/** Subscribe to non-blocking load errors (bad/missing audio file). */
export function onAmbientError(cb: () => void): () => void {
  return ambientEngine.onError(cb);
}

export function getAmbientLoadError(): string | null {
  return ambientEngine.getLoadError();
}
