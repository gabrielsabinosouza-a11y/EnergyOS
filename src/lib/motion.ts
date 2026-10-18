"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  useMotionValue,
  useSpring,
  useReducedMotion,
  type MotionValue,
  type Transition,
  type Variants,
} from "framer-motion";

// ── Spring presets (sempre 2 keyframes — nunca arrays de 3+ com spring) ──────
export const spring = {
  snappy:  { type: "spring", stiffness: 400, damping: 28 } satisfies Transition,
  gentle:  { type: "spring", stiffness: 220, damping: 24 } satisfies Transition,
  bouncy:  { type: "spring", stiffness: 500, damping: 22 } satisfies Transition,
  slow:    { type: "spring", stiffness: 120, damping: 20 } satisfies Transition,
  // Progress bar: massa baixa, resposta rápida e precisa.
  progress: { type: "spring", stiffness: 300, damping: 30 } satisfies Transition,
  // Press / tap feedback.
  press:   { type: "spring", stiffness: 500, damping: 24 } satisfies Transition,
  // Card lift / hover.
  lift:    { type: "spring", stiffness: 340, damping: 22 } satisfies Transition,
  // Celebration (curto, ~600 ms).
  celebrate: { type: "spring", stiffness: 420, damping: 26 } satisfies Transition,
} as const;

// ── Easing presets (keyframes de múltiplos passos usam ease + times) ─────────
export const ease = {
  out:  "easeOut" as const,
  inOut: "easeInOut" as const,
  circOut: [0.58, 1, 0.71, 0.97] as const,
  circInOut: [0.64, 0.09, 0.36, 0.97] as const,
} as const;

// ── Durações (ms) ────────────────────────────────────────────────────────────
export const duration = {
  micro: 0.12,   // micro-interações (120-200 ms)
  tap:   0.15,
  hover: 0.15,
  transition: 0.30, // 250-400 ms
  layout: 0.35,
  celebration: 0.60, // até ~700 ms
  exit: 0.20,
} as const;

// ── Page / route transition ──────────────────────────────────────────────────
export const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ── Card hover / tap ─────────────────────────────────────────────────────────
export const cardHover = { y: -2, transition: { duration: 0.15 } };
export const cardTap   = { scale: 0.98 };

// ── Button ───────────────────────────────────────────────────────────────────
export const btnHover = { scale: 1.03 } as const;
export const btnTap   = { scale: 0.92 } as const;

// ── Enter / exit (fade + rise + de-blur) ─────────────────────────────────────
export const enterVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0)",
    transition: { duration: 0.35, ease: "easeOut" },
  },
};
export const exitVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, transition: { duration: 0.2, ease: "easeOut" } },
};

// ── Staggered list container (apenas carga inicial) ──────────────────────────
export const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
export const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

// ── Reduced-motion safe helper ───────────────────────────────────────────────
export function useSafeMotion() {
  const reduced = useReducedMotion();
  return {
    pageVariants: reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants : pageVariants,
    listVariants: reduced ? {} as Variants : listVariants,
    itemVariants: reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants : itemVariants,
    enterVariants: reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants : enterVariants,
    exitVariants: reduced ? { hidden: { opacity: 0 } } as Variants : exitVariants,
    cardHover:    reduced ? {} : cardHover,
    cardTap:      reduced ? {} : cardTap,
    btnHover:     reduced ? {} : btnHover,
    btnTap:       reduced ? {} : btnTap,
    spring,
    ease,
    duration,
  };
}

/* ============================================================================
   Card hover / 3D tilt + specular highlight
   ---------------------------------------------------------------------------
   Tilt segue o ponteiro (máx ~6º), lift y: -2 ao pairar, highlight
   especular que acompanha o cursor. Desligado em telas touch e com
   prefers-reduced-motion.
   ============================================================================ */

interface UseCardTiltResult {
  style: React.CSSProperties;
  events: {
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  lift: MotionValue<number>;
  highlightX: MotionValue<number>;
  highlightY: MotionValue<number>;
}

export function useCardTilt({ enabled = true }: { enabled?: boolean } = {}): UseCardTiltResult {
  const reduced = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const lift = useMotionValue(0);
  const hx = useMotionValue(0);
  const hy = useMotionValue(0);

  const spring300 = { stiffness: 300, damping: 30 };

  const rotateX = useSpring(my, spring300);
  const rotateY = useSpring(mx, spring300);

  const active = enabled && !reduced;

  // Detona pointer grosso (touch): sem tilt.
  const pointerFine = useRef<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    pointerFine.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => { pointerFine.current = e.matches; };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!active || pointerFine.current === false) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;   // [-0.5, 0.5]
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(nx * 6);   // rotateY ~ ±6º
    my.set(-ny * 6);  // rotateX ~ ±6º (inverte: cima inclina p/ trás)
    hx.set(nx * 100); // highlight segue o cursor (px)
    hy.set(ny * 100);
  }, [active, mx, my, hx, hy]);

  const onPointerEnter = useCallback(() => {
    if (!active || pointerFine.current === false) return;
    lift.set(-2);
  }, [active, lift]);

  const onPointerLeave = useCallback(() => {
    if (!active) return;
    mx.set(0);
    my.set(0);
    lift.set(0);
    hx.set(0);
    hy.set(0);
  }, [active, mx, my, lift, hx, hy]);

  const style = {
    transformPerspective: 800,
    rotateX: rotateX as unknown as number,
    rotateY: rotateY as unknown as number,
    y: lift as unknown as number,
  } as unknown as React.CSSProperties;

  const events = { onPointerMove, onPointerEnter, onPointerLeave };

  return {
    style,
    events,
    rotateX,
    rotateY,
    lift,
    highlightX: hx,
    highlightY: hy,
  };
}

/* ============================================================================
   Otimização de cliques: fila por meta (sequence + abort controller)
   ============================================================================ */

export interface GoalActionQueueOptions {
  onAction: (goalId: number, action: string, seq: number) => Promise<void>;
  onSuccess?: (goalId: number, seq: number, value: unknown) => void;
  onError?: (goalId: number, seq: number, error: Error) => void;
}
