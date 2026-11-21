"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/*
 * GlassCard — premium glassmorphism surface for modals/onboarding.
 * Translucent gradient + backdrop blur, inner highlight border, layered
 * blue-tinted shadow, a slow diagonal shine sweep and a drifting aurora blob.
 * Pure CSS for the ambient layers; framer-motion only for enter/exit.
 */

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Disable the shine sweep / aurora (reduced-motion). */
  static?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function GlassCard({ children, className = "", static: isStatic, onClick }: GlassCardProps) {
  return (
    <motion.div
      initial={isStatic ? { opacity: 0 } : { opacity: 0, scale: 0.92, rotateX: 8, y: 14 }}
      animate={isStatic ? { opacity: 1 } : { opacity: 1, scale: 1, rotateX: 0, y: 0 }}
      exit={isStatic ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={`tour-glass ${className}`}
      style={{ transformPerspective: 900 } as CSSProperties}
      onClick={onClick}
    >
      <div className="tour-glass-aurora" aria-hidden />
      <div className="tour-glass-sweep" aria-hidden />
      <div className="tour-glass-inner">{children}</div>
    </motion.div>
  );
}
