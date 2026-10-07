"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

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
}: {
  value: string;
  label: string;
  amber?: boolean;
}) {
  return (
    <div className={`landing-led${amber ? " is-amber" : ""}`}>
      <span className="landing-led-value" aria-label={value}>{value}</span>
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
  const reducedMotion = useReducedMotion();
  return (
    <Link href={href} className={`landing-button${secondary ? " is-secondary" : ""} ${className}`}>
      <span>{children}</span>
      <motion.span
        aria-hidden="true"
        className="landing-button-arrow"
        animate={reducedMotion ? undefined : { x: [0, 2, 0] }}
        transition={reducedMotion ? undefined : { duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
      >
        <ArrowRight size={16} />
      </motion.span>
    </Link>
  );
}

export function Section({
  children,
  id,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode; id?: string }) {
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
