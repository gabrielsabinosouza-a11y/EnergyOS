"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Sons do modal de Recap (Web Audio API — sem arquivos binários, sem fetch).
 *
 * - `slide`   → sopro curto na troca de slide
 * - `tick`    → tique do contador de número
 * - `sparkle` → brilho quando o slide final aparece
 *
 * Regra de ouro: o áudio NUNCA é criado antes de um gesto do usuário. O
 * `AudioContext` só nasce dentro do clique do toggle de som (gesto válido) e
 * qualquer erro é engolido — som é um extra, nunca um requisito.
 */

export type RecapSoundName = "slide" | "tick" | "sparkle" | "start";

const STORAGE_KEY = "energyos:recap-sound";
const MASTER_GAIN = 0.13;

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/**
 * Cria/resume o AudioContext. DEVE rodar dentro de um gesto do usuário
 * (clique no botão de som) para a política de autoplay permitir o playback.
 */
export function primeRecapSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctor = getAudioCtor();
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* áudio indisponível — segue sem som */
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.45);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    // Ruído com leve declive para soar como um "whoosh" e não como chiado.
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  noiseBuffer = buffer;
  return buffer;
}

function playWhoosh(ctx: AudioContext, master: GainNode) {
  const t = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(1400, t);
  filter.frequency.exponentialRampToValueAtTime(320, t + 0.28);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(t);
  source.stop(t + 0.32);
}

function playTick(ctx: AudioContext, master: GainNode) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1180, t);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}

function playSparkle(ctx: AudioContext, master: GainNode) {
  const t = ctx.currentTime;
  [1568, 2093, 2637].forEach((freq, i) => {
    const at = t + i * 0.07;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.28, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);

    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.24);
  });
}

function playStart(ctx: AudioContext, master: GainNode) {
  const t = ctx.currentTime;
  // Ataque suave com duas notas ascendentes e um sopro curto, como abertura de capítulo.
  [523.25, 783.99, 1046.5].forEach((frequency, index) => {
    const at = t + index * 0.075;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(index === 2 ? 0.22 : 0.14, at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.44);
  });
  playWhoosh(ctx, master);
}

/** Toca um efeito do recap. Falha em silêncio se o áudio não estiver disponível. */
export function playRecapSound(name: RecapSoundName) {
  if (typeof window === "undefined") return;
  try {
    primeRecapSound();
    if (!audioCtx || audioCtx.state !== "running") return;

    const master = audioCtx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(audioCtx.destination);

    if (name === "slide") playWhoosh(audioCtx, master);
    else if (name === "tick") playTick(audioCtx, master);
    else if (name === "start") playStart(audioCtx, master);
    else playSparkle(audioCtx, master);
  } catch {
    /* áudio indisponível — segue sem som */
  }
}

/**
 * Preferência de som persistida.
 *
 * Usamos `useSyncExternalStore` para ler o localStorage sem `setState` dentro
 * de effect: o snapshot do servidor é sempre "desligado", então o HTML
 * servidor e o primeiro render do cliente coincidem (sem hydration mismatch).
 */
let cachedSoundEnabled: boolean | null = null;
const soundListeners = new Set<() => void>();

function readSound(): boolean {
  if (cachedSoundEnabled === null) {
    try {
      cachedSoundEnabled = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      cachedSoundEnabled = false;
    }
  }
  return cachedSoundEnabled;
}

function readServerSound(): boolean {
  return false;
}

function writeSound(value: boolean) {
  cachedSoundEnabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* localStorage bloqueado — a preferência vale só nesta sessão */
  }
  soundListeners.forEach((listener) => listener());
}

function subscribeSound(listener: () => void) {
  soundListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cachedSoundEnabled = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    soundListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Estado do som do recap: desligado por padrão, memorizado em localStorage.
 * `play` é seguro de chamar a qualquer momento (inclusive antes do primeiro
 * gesto — nesse caso o contexto nem existe e nada acontece).
 */
export function useRecapSound() {
  const enabled = useSyncExternalStore(subscribeSound, readSound, readServerSound);

  const toggle = useCallback(() => {
    const next = !readSound();
    writeSound(next);
    // Habilitar acontece dentro do clique: gesto válido para criar o contexto.
    if (next) primeRecapSound();
  }, []);

  const play = useCallback((name: RecapSoundName) => {
    if (!readSound()) return;
    playRecapSound(name);
  }, []);

  return { enabled, toggle, play };
}
