/**
 * Illustrative data for the "Como funciona" preview steps. No API calls —
 * everything here is a static, clearly-labeled demo.
 */

/** 7 bars (Seg → Dom), illustrative energy levels used by the Clareza step. */
export const CHART_BARS = [42, 68, 55, 82, 60, 74, 94];

/** Day labels for the weekly chart and the consistency check row. */
export const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Per-day check state for the consistency step (Friday = low activity). */
export const WEEK_DOTS = [true, true, true, true, false, true, true];
