/**
 * Shared motion/design tokens — single source of truth for animation timing,
 * easing curves and the 3D tilt preset. Keep UI animation values here so every
 * surface (cards, buttons, modals, celebrations) stays consistent.
 */

export const EASE = {
  /** Standard ease-out for entrances and hovers. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Slightly softer ease for exits. */
  inOut: [0.4, 0, 0.2, 1] as const,
  /** Coin flight / playful arcs. */
  arc: [0.22, 1, 0.36, 1] as const,
};

export const DUR = {
  fast: 0.12,
  base: 0.22,
  slow: 0.4,
} as const;

/** Spring presets for framer-motion `transition`. */
export const SPRING = {
  /** Snappy, slightly bouncy — chips, pills, small pops. */
  bouncy: { type: "spring", stiffness: 420, damping: 22 } as const,
  /** Smooth, no overshoot — cards, panels, layout returns. */
  smooth: { type: "spring", stiffness: 260, damping: 30 } as const,
} as const;

/** Mouse-follow 3D tilt limits (degrees). */
export const TILT = {
  maxDeg: 8,
  perspective: 900,
  scale: 1.015,
  disabledOnTouch: true,
} as const;

/** Elevation levels — applied via CSS vars in globals.css (.elev-1/2/3). */
export const ELEVATION = ["elev-1", "elev-2", "elev-3"] as const;

/** Format minutes as "50min" / "1h 15min" (no "0h" prefix under 1h). */
export function formatDurationPt(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
