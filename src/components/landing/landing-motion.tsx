"use client";

import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

export function LandingMotion() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    let lenis: { raf: (time: number) => void; destroy: () => void } | undefined;
    let frame = 0;
    let active = true;

    void import("lenis").then(({ default: Lenis }) => {
      if (!active) return;
      const instance = new Lenis({ autoRaf: false });
      lenis = instance;
      const raf = (time: number) => {
        instance.raf(time);
        frame = window.requestAnimationFrame(raf);
      };
      frame = window.requestAnimationFrame(raf);
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [reducedMotion]);

  return null;
}
