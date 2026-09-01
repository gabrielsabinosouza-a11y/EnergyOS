/**
 * Multi-layered completion alerts for focus sessions.
 *
 * Layers, in order of reliability:
 *   1. Tab title countdown + flash (no permissions needed; works on the taskbar/tab bar)
 *   2. Native system Notification (needs permission; works even minimized)
 *   3. WebAudio chime (works across apps if the speaker is on; unlocked by the start gesture)
 */

let baseTitle = "";
let countdownBusy = false;
let flashTimer: ReturnType<typeof setInterval> | null = null;

function readableTitle(): string {
  if (typeof document !== "undefined" && document.title) return document.title;
  return "energyOS";
}

function captureBase(): string {
  if (!baseTitle) baseTitle = readableTitle();
  return baseTitle;
}

/**
 * While the session is running and the tab is hidden, tick the tab title so the
 * user can glance at the tab bar and see progress. Does nothing when the tab is
 * focused so the page's own title is never clobbered.
 */
export function updateCountdownTabTitle(text: string) {
  if (typeof document === "undefined") return;
  if (document.hidden) {
    captureBase();
    countdownBusy = true;
    document.title = `${text} · energyOS`;
  }
}

/** Reports whether this module currently owns the tab title (countdown or flash). */
export function isTabTitleOwned(): boolean {
  return countdownBusy;
}

/**
 * Flash the tab title between "Sessão concluída!" and the normal title every
 * second. Self-cancels as soon as the tab regains focus. Safe to call even
 * while the tab is focused (no-ops).
 */
export function startCompletionTitleFlash() {
  if (typeof document === "undefined") return;
  captureBase();
  if (!document.hidden) return;
  if (flashTimer) clearInterval(flashTimer);
  countdownBusy = true;

  let on = true;
  document.title = "✅ Sessão concluída!";
  flashTimer = setInterval(() => {
    if (typeof document === "undefined") return;
    if (!document.hidden) {
      restoreTabTitle();
      return;
    }
    document.title = on ? "✅ Sessão concluída!" : baseTitle;
    on = !on;
  }, 1000);
}

/** Restore the normal tab title and stop any flashing/ticking. */
export function restoreTabTitle() {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  if (typeof document !== "undefined" && countdownBusy) {
    document.title = baseTitle;
    countdownBusy = false;
  }
}

/**
 * Fire a native system notification when the session ends out of view.
 * Clicking it focuses the energyOS tab. No-ops if permission was denied or the
 * tab is already visible (the in-app celebration covers that case).
 */
export function sendSystemCompletionNotification(coins: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && !document.hidden) return;
  try {
    const n = new Notification("Sessão concluída! 🔥", {
      body: `Sua energia cresceu completamente. +${coins} moedas — volte ao energyOS para resgatar.`,
      icon: "/icons_8bits/logo.png",
      tag: "session-complete",
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch { /* ignore */ }
      n.close();
    };
  } catch { /* Notifications can throw in unsupported/insecure contexts */ }
}

// ─── Completion chime (WebAudio — no binary asset, no fetch, autoplay-proof) ──

let audioCtx: AudioContext | null = null;

/**
 * Create/resume the AudioContext. MUST run inside a user gesture (the "Iniciar
 * foco" click) so autoplay policy allows the chime to play when the session
 * ends later, without direct user interaction.
 */
export function primeCompletionSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch { /* audio unsupported */ }
}

/** Soft, pleasant ascending chime (E5 → A5 → C#6, triangle + detuned sine). */
export function playCompletionSound() {
  if (typeof window === "undefined") return;
  try {
    if (!audioCtx) primeCompletionSound();
    if (!audioCtx || audioCtx.state !== "running") return;

    const t = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    master.connect(audioCtx.destination);

    const notes = [659.25, 880.0, 1108.73];
    notes.forEach((freq, i) => {
      const at = t + i * 0.09;
      const osc = audioCtx!.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const shimmer = audioCtx!.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 1.006;
      const g = audioCtx!.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.55, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 2.0);
      osc.connect(g);
      shimmer.connect(g);
      g.connect(master);
      osc.start(at);
      shimmer.start(at);
      osc.stop(at + 2.2);
      shimmer.stop(at + 2.2);
    });
  } catch { /* audio unsupported */ }
}