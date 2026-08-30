"use client";

import Image from "next/image";

export const COIN_IMAGE = "/coin/coins.png";

/**
 * Ícone de moeda do energyOS usando o asset real (/coin/coins.png),
 * em vez de um ícone genérico. Substitui o Coins do lucide em todo lugar
 * onde o saldo/recompensa em moedas é exibido.
 */
export function CoinIcon({ size = 14, className, style }: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src={COIN_IMAGE}
      alt="moedas"
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", ...style }}
      className={className}
    />
  );
}
