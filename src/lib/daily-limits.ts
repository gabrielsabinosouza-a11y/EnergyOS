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
export const KANBAN_DONE_XP = 10;
export const KANBAN_DONE_COINS = 10;

// ── Goals ─────────────────────────────────────────────────────────────────────
export const GOAL_CREATION_XP = 5;

/** Completion XP/coins tiered by targetValue. */
export const GOAL_COMPLETION_TIERS: { maxTarget: number; xp: number; coins: number }[] = [
  { maxTarget: 10,       xp: 30,  coins: 15 },
  { maxTarget: 100,      xp: 60,  coins: 20 },
  { maxTarget: Infinity, xp: 100, coins: 30 },
];

// ── Achievements ───────────────────────────────────────────────────────────────
//
// Reward granted each time a user reaches a new achievement tier. Tiers are
// ordered by difficulty (higher index = harder to reach). index 0 = first tier
// unlocked, etc. `tier` here is 1-based (matches unlocked_tier in
// user_achievement_progress).
export const ACHIEVEMENT_REWARD_TIERS: { xp: number; coins: number }[] = [
  { xp: 25,  coins: 50 },     // tier 1
  { xp: 75,  coins: 150 },    // tier 2
  { xp: 200, coins: 400 },    // tier 3
  { xp: 500, coins: 1000 },   // tier 4+
];

/** Fallback used when an achievement has more tiers than ACHIEVEMENT_REWARD_TIERS. */
export const ACHIEVEMENT_REWARD_FALLBACK = ACHIEVEMENT_REWARD_TIERS[ACHIEVEMENT_REWARD_TIERS.length - 1];

// ── Focus ─────────────────────────────────────────────────────────────────────
/**
 * Minimum fraction of a focus session's target duration that must be completed
 * for it to count toward the streak. 1.0 = the full target must be reached;
 * 0.8 = 80 % is enough. Stored as a fraction so it can be compared directly
 * against `duration_minutes / target_duration_minutes`.
 */
export const STREAK_COMPLETION_THRESHOLD = 1.0;

/** XP per minute of focus (base, before boost). */
export const FOCUS_XP_PER_MIN = 1;
/** Coins per 10 minutes of focus. */
export const FOCUS_COINS_PER_10_MIN = 1;
