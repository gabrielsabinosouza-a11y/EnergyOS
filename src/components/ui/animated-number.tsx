"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/design-tokens";

/**
 * Animated count-up/count-down number. Tweens toward `value` with rAF and
 * ease-out; snaps instantly under prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  duration = DUR.slow,
  className,
  format = (n: number) => Math.round(n).toLocaleString("pt-BR"),
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion() ?? false;
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    fromRef.current = to;
    if (reduced || from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- EASE cubic is fixed
  }, [value, duration, reduced]);

  return <span className={className}>{format(display)}</span>;
}
