/** Max daily missions shown per user (random pick from the pool). */
export const DAILY_MISSION_LIMIT = 3;

/** Max user-written daily tasks per day. */
export const DAILY_TASK_LIMIT = 3;

/** XP per completed user daily task. */
export const DAILY_TASK_XP = 10;

/** Coins per completed user daily task. */
export const DAILY_TASK_COINS = 5;

/** Bonus coins when all daily tasks are completed. */
export const DAILY_TASK_ALL_BONUS_COINS = 10;

// ── Check-in ──────────────────────────────────────────────────────────────────
export const CHECKIN_XP = 15;
export const CHECKIN_COINS = 5;

/** Per-day streak bonus XP (added on top of check-in XP). Capped at STREAK_BONUS_CAP. */
export const STREAK_BONUS_XP_PER_DAY = 5;
export const STREAK_BONUS_CAP = 50;

// ── Kanban ────────────────────────────────────────────────────────────────────
export const KANBAN_XP_BY_PRIORITY: Record<string, number> = { low: 10, medium: 15, high: 20 };
export const KANBAN_DONE_COINS = 5;

// ── Goals ─────────────────────────────────────────────────────────────────────
export const GOAL_CREATION_XP = 5;

/** Completion XP/coins tiered by targetValue. */
export const GOAL_COMPLETION_TIERS: { maxTarget: number; xp: number; coins: number }[] = [
  { maxTarget: 10,       xp: 30,  coins: 15 },
  { maxTarget: 100,      xp: 60,  coins: 20 },
  { maxTarget: Infinity, xp: 100, coins: 30 },
];

// ── Focus ─────────────────────────────────────────────────────────────────────
/** XP per minute of focus (base, before boost). */
export const FOCUS_XP_PER_MIN = 1;
/** Coins per 10 minutes of focus. */
export const FOCUS_COINS_PER_10_MIN = 1;
