"use client";

import Image from "next/image";

export const STREAK_SAVED_IMAGE = "/streak/streak_alive.png";
export const STREAK_PROTECTED_IMAGE = "/streak/streak_protected.png";
export const STREAK_LOST_IMAGE = "/streak/streak_lost.png";
export const SHIELD_CALENDAR_IMAGE = "/streak/shield_for_calenda.png";

export type StreakVariant = "saved" | "protected" | "lost";

/**
 * Ícone customizado de chama de streak (usa os assets low-poly de
 * `public/streak/`), seguindo o mesmo padrão de props do `XpIcon`.
 * `variant` seleciona o estado: saved / protected / lost.
 */
export function StreakIcon({ size = 16, variant = "saved", className, style }: {
  size?: number;
  variant?: StreakVariant;
  className?: string;
  style?: React.CSSProperties;
}) {
  const src =
    variant === "protected"
      ? STREAK_PROTECTED_IMAGE
      : variant === "lost"
        ? STREAK_LOST_IMAGE
        : STREAK_SAVED_IMAGE;
  return (
    <Image
      src={src}
      alt={variant === "protected" ? "Sequência protegida" : variant === "lost" ? "Sequência perdida" : "Foco completo"}
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", ...style }}
      className={className}
    />
  );
}

/**
 * Ícone de escudo dedicado ao calendário de sequência (asset azul-ciano de
 * `public/streak/`), no mesmo padrão do `XpIcon`.
 */
export function ShieldIcon({ size = 16, className, style }: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src={SHIELD_CALENDAR_IMAGE}
      alt="Protegido por escudo"
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", ...style }}
      className={className}
    />
  );
}
