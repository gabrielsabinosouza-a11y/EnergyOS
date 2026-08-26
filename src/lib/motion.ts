import { useReducedMotion } from "framer-motion";
import type { Variants, Transition } from "framer-motion";

// ── Spring presets ──────────────────────────────────────────────────────────
export const spring = {
  snappy:  { type: "spring", stiffness: 400, damping: 28 } satisfies Transition,
  gentle:  { type: "spring", stiffness: 220, damping: 24 } satisfies Transition,
  bouncy:  { type: "spring", stiffness: 500, damping: 22 } satisfies Transition,
  slow:    { type: "spring", stiffness: 120, damping: 20 } satisfies Transition,
};

// ── Easing presets ──────────────────────────────────────────────────────────
export const ease = {
  out: "easeOut" as const,
};

// ── Page / route transition ─────────────────────────────────────────────────
export const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ── Staggered list container ────────────────────────────────────────────────
export const listVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

// ── Card hover / tap ────────────────────────────────────────────────────────
export const cardHover = { y: -2, transition: { duration: 0.15 } };
export const cardTap   = { scale: 0.98 };

// ── Button ──────────────────────────────────────────────────────────────────
export const btnHover = { scale: 1.03 } as const;
export const btnTap   = { scale: 0.96 } as const;

// ── Reduced-motion safe hook ────────────────────────────────────────────────
export function useSafeMotion() {
  const reduced = useReducedMotion();
  return {
    pageVariants: reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants : pageVariants,
    listVariants: reduced ? {} as Variants : listVariants,
    itemVariants: reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants : itemVariants,
    cardHover:    reduced ? {} : cardHover,
    cardTap:      reduced ? {} : cardTap,
    btnHover:     reduced ? {} : btnHover,
    btnTap:       reduced ? {} : btnTap,
    spring,
  };
}
