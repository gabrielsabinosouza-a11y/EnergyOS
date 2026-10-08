import { FOCUS_DURATION_MIN_MINUTES } from "./focus-duration";

/** Max daily missions shown per user (random pick from the pool). */
export const DAILY_MISSION_LIMIT = 3;

/** Max active habits per user. */
export const HABIT_LIMIT = 10;

/** XP per completed habit. */
export const HABIT_XP = 10;

/** Coins per completed habit. */
export const HABIT_COINS = 5;

/** Bonus coins when all habits are completed. */
export const HABIT_ALL_BONUS_COINS = 10;

/** @deprecated Renamed to HABIT_LIMIT. */
export const DAILY_TASK_LIMIT = HABIT_LIMIT;
/** @deprecated Renamed to HABIT_XP. */
export const DAILY_TASK_XP = HABIT_XP;
/** @deprecated Renamed to HABIT_COINS. */
export const DAILY_TASK_COINS = HABIT_COINS;
/** @deprecated Renamed to HABIT_ALL_BONUS_COINS. */
export const DAILY_TASK_ALL_BONUS_COINS = HABIT_ALL_BONUS_COINS;

// ── Check-in ──────────────────────────────────────────────────────────────────
export const CHECKIN_XP = 15;
export const CHECKIN_COINS = 5;

/** Per-day streak bonus XP (added on top of check-in XP). Capped at STREAK_BONUS_CAP. */
export const STREAK_BONUS_XP_PER_DAY = 5;
export const STREAK_BONUS_CAP = 50;

// ── Kanban ────────────────────────────────────────────────────────────────────
export const KANBAN_DONE_XP = 25;
export const KANBAN_DONE_COINS = 25;

// ── Weekly planner ────────────────────────────────────────────────────────────
/** XP/coins per completed weekly-plan task (awarded once per plan, ever). */
export const WEEKLY_PLAN_DONE_XP = 10;
export const WEEKLY_PLAN_DONE_COINS = 10;

// ── Goals ─────────────────────────────────────────────────────────────────────
export const GOAL_CREATION_XP = 5;

/**
 * Recompensa ÚNICA de conclusão de uma meta, paga UMA vez quando ela atinge o
 * alvo. O pagamento é idempotente pelo id determinístico
 * `goal:<goalId>:u:once` no xp_ledger, e é estornado se o progresso voltar
 * abaixo do alvo (o usuário não pode "desconcluir" e re-concluir de graça).
 */
export const GOAL_COMPLETE_REWARD = { coins: 50, xp: 50 } as const;

/** @deprecated Legado: metas não têm mais frequência. Mantido só para leitura. */
export const GOAL_DONE_XP = 15;
/** @deprecated Legado: metas não têm mais frequência. Mantido só para leitura. */
export const GOAL_DONE_COINS = 15;

/** XP/coins for a unique (once-in-a-lifetime) goal, like "become a navy seal". */
export const GOAL_UNIQUE_DONE_XP = 50;
export const GOAL_UNIQUE_DONE_COINS = 50;

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

// ── Reward de moedas por sessão de foco ─────────────────────────────────────
// Regra: 25 moedas por hora focada (arredondado), com teto de 50.
// O piso de 9 só vale a partir da duração mínima de sessão (10 min); abaixo
// disso as moedas ficam proporcionais ao tempo, sem piso, para não dar para
// farmar encerrando uma sessão de 120 min em 1 min.
//  - 10 min   -> max(9, round(10*25/60)) = 9
//  - 60 min   -> 25
//  - 120 min  -> 50 (teto, equivale à duração máxima de 120 min)
export const FOCUS_COINS_PER_HOUR = 25;
/** Piso de moedas por sessão (aplicado apenas a sessões de 10 min ou mais). */
export const FOCUS_COINS_MIN = 9;
/** Teto de moedas por sessão de foco (120 min * 25/60). */
export const FOCUS_COINS_CAP = 50;

/**
 * Moedas de uma sessão de foco, calculadas apenas a partir dos minutos focados.
 * As moedas nunca são escaladas pela poção 2x XP — essa poção multiplica só XP
 * (via creditXP → calculateXPWithBoost).
 */
export function focusCoinsForDuration(minutes: number): number {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const rateCoins = Math.round((m / 60) * FOCUS_COINS_PER_HOUR);
  const minCoins = m >= FOCUS_DURATION_MIN_MINUTES ? FOCUS_COINS_MIN : 0;
  return Math.min(FOCUS_COINS_CAP, Math.max(minCoins, rateCoins));
}
