"use client";

import Image from "next/image";

export const XP_IMAGE = "/xp/xp.png";
export const XP_DOUBLE_IMAGE = "/xp/xp_double_thunder.png";

/** Ícone de nível (1–4) correspondente ao XP total do usuário. */
const XP_LEVEL_IMAGES = [
  "/Niveis/nivel1.png",
  "/Niveis/nivel2.png",
  "/Niveis/nivel3.png",
  "/Niveis/nivel4.png",
];

export function xpLevelImage(level: number): string {
  return XP_LEVEL_IMAGES[Math.min(level, XP_LEVEL_IMAGES.length) - 1] ?? XP_IMAGE;
}

/**
 * Ícone de XP do energyOS usando o asset customizado (cristal de raio low-poly),
 * em vez do Zap genérico do lucide. `variant="double"` troca para a versão roxa
 * usada nos indicadores de "XP em dobro". Quando `level` (1–4) é passado, usa o
 * ícone do nível correspondente da pasta `/Niveis/`.
 */
export function XpIcon({ size = 14, variant = "normal", level, className, style }: {
  size?: number;
  variant?: "normal" | "double";
  level?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const src = level ? xpLevelImage(level) : variant === "double" ? XP_DOUBLE_IMAGE : XP_IMAGE;
  return (
    <Image
      src={src}
      alt={level ? `Nível ${level}` : variant === "double" ? "XP em dobro" : "XP"}
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", ...style }}
      className={className}
    />
  );
}