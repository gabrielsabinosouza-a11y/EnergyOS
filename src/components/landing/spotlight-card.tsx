"use client";

import type { HTMLAttributes, MouseEvent } from "react";
import { GlassCard } from "./primitives";

export function SpotlightCard({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  function trackPointer(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <GlassCard {...props} className={`landing-feature-card ${className}`} onMouseMove={trackPointer}>
      <div className="feature-spotlight" aria-hidden="true" />
      {children}
    </GlassCard>
  );
}
