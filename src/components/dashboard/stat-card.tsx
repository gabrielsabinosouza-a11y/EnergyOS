"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconContent?: ReactNode;
  /** Cor temática (hex) usada no chip, no valor e no brilho. */
  color: string;
}

/** Card de métrica da página Consistência (mesmo visual dos painéis do relatório). */
export function StatCard({ label, value, hint, icon: Icon, iconContent, color }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -35px 0px" });
  const reducedMotion = useReducedMotion();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (current) => Math.round(current).toLocaleString("pt-BR"));
  useEffect(() => {
    if (typeof value !== "number" || !inView) return;
    if (reducedMotion) { count.set(value); return; }
    const controls = animate(count, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [count, inView, reducedMotion, value]);
  return (
    <div ref={ref} className="panel rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="rounded-full p-2.5"
          style={{
            backgroundColor: `${color}20`,
            color,
            boxShadow: `0 0 0 2px ${color}55, 0 0 12px ${color}66, inset 0 0 8px ${color}33`,
          }}
        >
          {iconContent ?? <Icon size={22} />}
        </div>
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <div className="font-display text-4xl tracking-[-0.04em]" style={{ color }}>
        {typeof value === "number" ? <motion.span>{rounded}</motion.span> : value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}
