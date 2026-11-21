"use client";

import type { ReactNode } from "react";
import { Egg, Rabbit } from "lucide-react";

/** Ícone de Páscoa - ovo de Páscoa */
export function EasterIcon({
  size = 20,
  className,
  style,
  title,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}): ReactNode {
  return (
    <Egg
      width={size}
      height={size}
      className={className}
      style={{ ...style, color: "#f0a6c8" }}
      aria-label={title || "Páscoa"}
    />
  );
}

/** Ícone de Coelhinho de Páscoa */
export function BunnyIcon({
  size = 20,
  className,
  style,
  title,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}): ReactNode {
  return (
    <Rabbit
      width={size}
      height={size}
      className={className}
      style={{ ...style, color: "#f0a6c8" }}
      aria-label={title || "Coelhinho de Páscoa"}
    />
  );
}
