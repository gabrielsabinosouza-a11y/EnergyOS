"use client";

import type { HTMLAttributes, ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function GlassCard({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`landing-glass ${className}`} {...props}>{children}</div>;
}

export function LedNumber({
  value,
  label,
  amber = false,
  countTo,
  suffix = "",
}: {
  value: string;
  label: string;
  amber?: boolean;
  countTo?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reducedMotion = useReducedMotion();
  const count = useMotionValue(0);
  const countText = useTransform(count, (value) => `${Math.round(value)}${suffix}`);
  useEffect(() => {
    if (!inView || countTo === undefined) return;
    if (reducedMotion) {
      count.set(countTo);
      return;
    }
    const controls = animate(count, countTo, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [count, countTo, inView, reducedMotion]);

  return (
    <div ref={ref} className={`landing-led${amber ? " is-amber" : ""}`}>
      {countTo === undefined
        ? <span className="landing-led-value" data-led={value} aria-label={value}>{value}</span>
        : <motion.span className="landing-led-value" data-led={value} aria-label={value}>{countText}</motion.span>}
      <span className="landing-led-label">{label}</span>
    </div>
  );
}

export function LightBeam({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`landing-light-beam ${className}`} />;
}

export function GrainOverlay() {
  return <div aria-hidden="true" className="landing-grain" />;
}

export function GradientHeading({
  as: Tag = "h2",
  children,
  className = "",
}: {
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={`landing-gradient-heading ${className}`}>{children}</Tag>;
}

export function GlowButton({
  href,
  children,
  secondary = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`landing-button${secondary ? " is-secondary" : ""} ${className}`}>
      <span>{children}</span>
      <span aria-hidden="true" className="landing-button-arrow">
        <ArrowRight size={16} />
      </span>
    </Link>
  );
}

export function Section({
  children,
  id,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragEnd" | "onDragStart"> & {
  children: ReactNode;
  id?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={`landing-section ${className}`}
      initial={reducedMotion ? false : { opacity: 0, y: 22, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.section>
  );
}
