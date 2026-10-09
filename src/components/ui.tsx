"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, PropsWithChildren, ReactNode, Ref } from "react";
import { btnHover, btnTap } from "@/lib/motion";
import { LoaderCircle } from "lucide-react";

type ActionButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
type ActionButtonSize = "sm" | "md" | "lg";
const ACTION_BUTTON_HEIGHT: Record<ActionButtonSize, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" };
const ACTION_BUTTON_ICON: Record<ActionButtonSize, number> = { sm: 14, md: 16, lg: 18 };
const ACTION_BUTTON_VARIANT: Record<ActionButtonVariant, string> = {
  primary: "border border-cyan-200/20 bg-[var(--accent)] text-slate-950 shadow-[inset_0_1px_rgba(255,255,255,.28),0_2px_0_rgba(0,0,0,.24)] hover:brightness-105",
  secondary: "border border-white/10 bg-white/[.06] text-[var(--text)] hover:bg-white/[.1]",
  ghost: "border border-transparent text-[var(--text-muted)] hover:bg-white/[.06] hover:text-[var(--text)]",
  success: "border border-emerald-300/15 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20",
  danger: "border border-red-300/15 bg-red-500/10 text-red-200 hover:bg-red-500/15",
};
export function Button({ variant = "secondary", size = "md", loading = false, children, className = "", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ActionButtonVariant; size?: ActionButtonSize; loading?: boolean }) {
  return <button {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition-[transform,opacity,background-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_BUTTON_HEIGHT[size]} ${ACTION_BUTTON_VARIANT[variant]} ${className}`}>
    {loading && <LoaderCircle size={ACTION_BUTTON_ICON[size]} className="animate-spin" aria-hidden="true" />}{children}
  </button>;
}
export function IconButton({ size = "md", variant = "ghost", loading = false, className = "", children, ref, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: ActionButtonSize; variant?: ActionButtonVariant; loading?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const sizeClass: Record<ActionButtonSize, string> = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };
  return <button {...props} ref={ref} disabled={props.disabled || loading} aria-busy={loading || undefined} className={`inline-flex shrink-0 items-center justify-center rounded-lg border font-medium transition-[transform,opacity,background-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-0.5 disabled:opacity-50 ${sizeClass[size]} ${ACTION_BUTTON_VARIANT[variant]} ${className}`}>
    {loading ? <LoaderCircle size={ACTION_BUTTON_ICON[size]} className="animate-spin" aria-hidden="true" /> : children}
  </button>;
}

// ── GlowCard ────────────────────────────────────────────────────────────────
// A glass panel with an optional ambient colored glow behind it.
interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string; // e.g. "rgba(113,212,255,.15)"
  as?: "section" | "div" | "article";
}

export function GlowCard({ children, className = "", glowColor, as: Tag = "div" }: GlowCardProps) {
  return (
    <Tag className={`relative overflow-hidden panel ${className}`}>
      {glowColor && (
        <span
          aria-hidden
          className="ambient-glow"
          style={{ width: 260, height: 260, top: -80, right: -60, background: glowColor }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </Tag>
  );
}

// ── GlassButton ─────────────────────────────────────────────────────────────
export function GlassButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      whileHover={reduced ? undefined : { scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] backdrop-blur-sm transition-colors hover:border-white/20 hover:text-[var(--text)] ${className}`}
      {...(props as object)}
    >
      {children}
    </motion.button>
  );
}

// ── PrimaryButton ────────────────────────────────────────────────────────────
export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      whileHover={reduced ? undefined : { scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`primary-button ${className}`}
      {...(props as object)}
    >
      {children}
    </motion.button>
  );
}

// ── AnimatedNumber ───────────────────────────────────────────────────────────
// Counts up from 0 to `value` on mount.
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  className = "",
  duration = 0.7,
  style,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  duration?: number;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) { setDisplay(value); return; }
    const from = 0;
    const to = value;
    const ms = duration * 1000;

    function tick(ts: number) {
      if (!start.current) start.current = ts;
      const progress = Math.min((ts - start.current) / ms, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Format with pt-BR locale (comma separator) when decimals > 0
  const formatValue = (num: number, dec: number): string => {
    if (dec === 0) {
      return Math.round(num).toLocaleString("pt-BR");
    }
    const rounded = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
    return rounded.toLocaleString("pt-BR", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  return (
    <span className={className} style={style}>
      {formatValue(display, decimals)}{suffix}
    </span>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
// Animates from 0 → value on mount using Framer Motion.
export function ProgressBar({
  value,
  color = "var(--accent)",
  glowColor,
}: {
  value: number;
  color?: string;
  glowColor?: string;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div className="progress-track" aria-label={`${clamped}% concluído`} role="progressbar" aria-valuenow={clamped}>
      <motion.div
        className="progress-value"
        initial={{ width: reduced ? `${clamped}%` : "0%" }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: color, boxShadow: `0 0 14px ${glowColor ?? color}` }}
      />
    </div>
  );
}

// ── ProgressRing ─────────────────────────────────────────────────────────────
export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = "var(--accent)",
  children,
}: PropsWithChildren<{ value: number; size?: number; stroke?: number; color?: string }>) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(value, 100));
  const offset = circ - (clamped / 100) * circ;

  const springOffset = useSpring(reduced ? offset : circ, { stiffness: 80, damping: 18 });
  const motionOffset = useMotionValue(circ);

  useEffect(() => {
    if (reduced) { motionOffset.set(offset); return; }
    springOffset.set(offset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={reduced ? offset : springOffset}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

// ── Card (legacy compat) ─────────────────────────────────────────────────────
export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`}>{children}</section>;
}

// ── Input ────────────────────────────────────────────────────────────────────
export function Input({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className="field-label">
      {label}
      <input className={`auth-input ${className}`} {...props} />
    </label>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ children, title, onClose }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="text-button" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}
