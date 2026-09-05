"use client";

import Image from "next/image";

export const XP_IMAGE = "/xp/xp.png";
export const XP_DOUBLE_IMAGE = "/xp/xp_double_thunder.png";

/**
 * Ícone de XP do energyOS usando o asset customizado (cristal de raio low-poly),
 * em vez do Zap genérico do lucide. `variant="double"` troca para a versão roxa
 * usada nos indicadores de "XP em dobro".
 */
export function XpIcon({ size = 14, variant = "normal", className, style }: {
  size?: number;
  variant?: "normal" | "double";
  className?: string;
  style?: React.CSSProperties;
}) {
  const src = variant === "double" ? XP_DOUBLE_IMAGE : XP_IMAGE;
  return (
    <Image
      src={src}
      alt={variant === "double" ? "XP em dobro" : "XP"}
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", ...style }}
      className={className}
    />
  );
}