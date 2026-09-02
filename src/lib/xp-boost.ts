// ── Poção de XP Duplo — shared config & metadata ────────────────────────────
// All tunables for the 2x XP booster live here so they can be adjusted without
// hunting through the codebase. Keep everything read-only / pure in this file.

export const XP_BOOST_ITEM_TYPE = "xp_boost_2x";

/** Purchase price, in coins. */
export const XP_BOOST_COST = 250;

/** Hard cap on unused potions a user may hold at any time. */
export const XP_BOOST_MAX_HELD = 2;

/** Duration of a single boost once activated, in milliseconds (60 minutes). */
export const XP_BOOST_DURATION_MS = 60 * 60 * 1000;

/** XP multiplier applied while a boost is active. */
export const XP_BOOST_MULTIPLIER = 2;

// Item metadata for the store/inventory card. `iconPath` is a prop-ready asset
// path so the real custom PNG can be dropped in without changing code.
export const XP_BOOST_ITEM = {
  id: XP_BOOST_ITEM_TYPE,
  name: "Poção de XP Duplo",
  description:
    "Dobre todo o XP ganho durante 60 minutos: foco, missões, tarefas diárias e marcos de sequência.",
  price: XP_BOOST_COST,
  // Placeholder until the custom 2x potion asset is delivered.
  iconPath: "/xp-boost/potion_2x.png",
  accent: "#b69cff",
  glow: "rgba(182,156,255,0.4)",
} as const;

/** Apply a boost multiplier to a base XP amount (no DB access). */
export function applyXPBoost(baseXP: number, multiplier: number | null): number {
  if (!Number.isFinite(baseXP) || baseXP <= 0) return Math.max(0, Math.round(baseXP || 0));
  if (!multiplier || multiplier <= 1) return Math.round(baseXP);
  return Math.round(baseXP * multiplier);
}
