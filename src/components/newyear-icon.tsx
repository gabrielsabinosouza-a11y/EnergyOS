"use client";

import type { ReactNode } from "react";
import { PartyPopper, Wine, MoonStar } from "lucide-react";

/** Ícone de Ano Novo - fogos de artifício */
export function NewYearIcon({
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
    <PartyPopper
      width={size}
      height={size}
      className={className}
      style={{ ...style, color: "#ffd76b" }}
      aria-label={title || "Ano Novo"}
    />
  );
}

/** Ícone de Champanhe - celebração de Ano Novo */
export function ChampagneIcon({
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
    <Wine
      width={size}
      height={size}
      className={className}
      style={{ ...style, color: "#ffd76b" }}
      aria-label={title || "Celebração de Ano Novo"}
    />
  );
}

/** Ícone de Relógio da Meia-Noite */
export function MidnightClockIcon({
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
    <MoonStar
      width={size}
      height={size}
      className={className}
      style={{ ...style, color: "#ffd76b" }}
      aria-label={title || "Meia-Noite"}
    />
  );
}
