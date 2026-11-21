/**
 * Session-completion celebration: timing constants (tweak here) and the
 * "celebration pending" flag helpers.
 *
 * The reward itself is ALWAYS granted server-side when the session ends —
 * this module only controls the presentation layer. The pending flag makes
 * sure a celebration that completed while the tab was hidden/reloaded (or on
 * another tab) is shown exactly once, then never again.
 */

export const CELEBRATION = {
  /** ~1s finish moment before the reward panel appears. */
  finishMs: 1100,
  /** Auto-collect if the user doesn't click within this window. */
  autoCollectMs: 8000,
  /** Max coins that fly to the header chip (perf cap). */
  maxFlyingCoins: 20,
  /** Min coins that fly for tiny rewards (keeps the moment alive). */
  minFlyingCoins: 5,
  /** Burst-out phase before coins fly to the chip. */
  burstMs: 380,
  /** Flight duration per coin (staggered on top of this). */
  flightMs: 720,
  /** Stagger between coin launches. */
  staggerMs: 55,
  /** How long the landed chip keeps glowing after the last coin. */
  chipPulseMs: 600,
} as const;

/** Number of coin sprites to fly for a reward of `coins` coins. */
export function celebrationCoinCount(coins: number): number {
  if (coins <= 0) return 0;
  const scaled = Math.ceil(coins / 10);
  return Math.max(CELEBRATION.minFlyingCoins, Math.min(CELEBRATION.maxFlyingCoins, scaled));
}

// ─── Pending celebration flag (localStorage, claim-once) ────────────────────

export interface PendingCelebration {
  /** Server session id — used as the idempotency key for "shown once". */
  sessionId: number;
  coins: number;
  xp: number;
  durationMinutes: number;
  /** Streak before/after when the API reported a change (optional). */
  streakPrevious?: number;
  streakCurrent?: number;
  auraId?: string | null;
  createdAt: number;
}

const PENDING_KEY = "energyos_pending_celebration";
const seenKey = (sessionId: number) => `energyos_celebration_seen_${sessionId}`;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Store a celebration to be shown on next app open (survives reload). */
export function markCelebrationPending(
  data: Omit<PendingCelebration, "createdAt">,
  store: StorageLike | null = defaultStorage(),
): void {
  if (!store) return;
  try {
    const payload: PendingCelebration = { ...data, createdAt: Date.now() };
    store.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch { /* storage full/blocked — celebration just won't replay */ }
}

/**
 * Claim the pending celebration. Returns it the FIRST time it is called for a
 * given session and null afterwards — so reloads and second tabs never show
 * the same celebration twice.
 */
export function claimPendingCelebration(
  store: StorageLike | null = defaultStorage(),
): PendingCelebration | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingCelebration;
    if (typeof data.sessionId !== "number") {
      store.removeItem(PENDING_KEY);
      return null;
    }
    // Already celebrated this session (e.g. flag rewritten after a reload
    // race) — consume it without showing again.
    if (store.getItem(seenKey(data.sessionId))) {
      store.removeItem(PENDING_KEY);
      return null;
    }
    // Mark seen BEFORE returning so a second tab/reload can't claim it too.
    store.setItem(seenKey(data.sessionId), String(Date.now()));
    store.removeItem(PENDING_KEY);
    return data;
  } catch {
    try { store.removeItem(PENDING_KEY); } catch { /* ignore */ }
    return null;
  }
}

/** Drop the pending flag without showing (e.g. give-up path or dev reset). */
export function clearPendingCelebration(store: StorageLike | null = defaultStorage()): void {
  if (!store) return;
  try { store.removeItem(PENDING_KEY); } catch { /* ignore */ }
}
