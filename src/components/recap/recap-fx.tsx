"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

// ─── Tilt 3D + glare ───────────────────────────────────────────────────────────

export interface RecapTilt {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  glareX: MotionValue<string>;
  glareY: MotionValue<string>;
  glareOpacity: MotionValue<number>;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Inclinação 3D suave (máx. ~8°) seguindo o ponteiro + glare que acompanha o
 * cursor. Em dispositivos de toque o mesmogesto funciona durante o arraste.
 * Com `prefers-reduced-motion` a inclinação é desligada.
 */
export function useRecapTilt(maxTilt = 8): RecapTilt {
  const reduced = useReducedMotion();
  const rotateXRaw = useMotionValue(0);
  const rotateYRaw = useMotionValue(0);
  const glareXRaw = useMotionValue(50);
  const glareYRaw = useMotionValue(50);
  const glareOpacity = useMotionValue(0);

  const rotateX = useSpring(rotateXRaw, { stiffness: 220, damping: 20, mass: 0.4 });
  const rotateY = useSpring(rotateYRaw, { stiffness: 220, damping: 20, mass: 0.4 });
  const glareX = useTransform(glareXRaw, (value) => `${value}%`);
  const glareY = useTransform(glareYRaw, (value) => `${value}%`);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reduced) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      rotateYRaw.set((px - 0.5) * maxTilt * 2);
      rotateXRaw.set(-(py - 0.5) * maxTilt * 2);
      glareXRaw.set(px * 100);
      glareYRaw.set(py * 100);
      glareOpacity.set(1);
    },
    [glareOpacity, glareXRaw, glareYRaw, maxTilt, reduced, rotateXRaw, rotateYRaw],
  );

  const onPointerLeave = useCallback(() => {
    rotateXRaw.set(0);
    rotateYRaw.set(0);
    glareOpacity.set(0);
  }, [glareOpacity, rotateXRaw, rotateYRaw]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reduced) return;
      onPointerMove(event);
    },
    [onPointerMove, reduced],
  );

  return { rotateX, rotateY, glareX, glareY, glareOpacity, onPointerMove, onPointerLeave, onPointerDown };
}

// ─── Painel de vidro (glassmorphism) ───────────────────────────────────────────

export interface GlassPanelProps {
  accent: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Card de vidro: preenchimento translúcido, borda em gradiente de 1px,
 * highlight interno no topo-esquerda e sombra colorida do slide.
 * O canvas de exportação usa cores sólidas equivalentes (sem backdrop-filter).
 */
export function GlassPanel({ accent, className = "", style, children }: GlassPanelProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        border: "1px solid transparent",
        backgroundImage: `linear-gradient(150deg, rgba(255,255,255,.11), rgba(255,255,255,.03) 60%, rgba(255,255,255,.02)), linear-gradient(150deg, ${accent}aa, rgba(255,255,255,.10) 45%, ${accent}44)`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: `0 18px 42px -24px rgba(0,0,0,.75), 0 0 46px -20px ${accent}80, inset 0 1px 0 rgba(255,255,255,.20)`,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 12% 0%, ${accent}26, transparent 58%)` }}
      />
      {children}
    </div>
  );
}

// ─── Card de vidro com inclinação 3D ──────────────────────────────────────────

export interface TiltCardProps {
  accent: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Card de vidro que inclina até 6° seguindo o ponteiro, com glare especular
 * no mesmo ponto. Desligado com `prefers-reduced-motion`.
 */
export function TiltCard({ accent, className = "", children }: TiltCardProps) {
  const tilt = useRecapTilt(6);
  const glareBackground = useTransform(
    [tilt.glareX, tilt.glareY],
    ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,.26), transparent 55%)`,
  );

  return (
    <motion.div
      className="relative h-full"
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 900 }}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      onPointerDown={tilt.onPointerDown}
    >
      <GlassPanel accent={accent} className={`h-full ${className}`}>
        {children}
      </GlassPanel>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: glareBackground, opacity: tilt.glareOpacity }}
      />
    </motion.div>
  );
}

// ─── Partículas de ambiente ────────────────────────────────────────────────────

/**
 * Camada de partículas do ambiente (~20, GPU-friendly: só transform/opacity).
 * Pausa quando a aba fica em segundo plano.
 */
export function ParticleField({ accent, count = 20 }: { accent: string; count?: number }) {
  const reduced = useReducedMotion();
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (reduced) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, index) => {
        const size = 2 + (index % 3);
        const left = 6 + ((index * 37) % 88);
        const top = 8 + ((index * 53) % 84);
        return (
          <motion.span
            key={index}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              background: accent,
              boxShadow: `0 0 ${size * 3}px ${accent}`,
            }}
            animate={
              tabVisible
                ? { y: [0, -16, 0], opacity: [0.12, 0.42, 0.12] }
                : { y: 0, opacity: 0.12 }
            }
            transition={{
              duration: 3.4 + (index % 5) * 0.7,
              repeat: tabVisible ? Infinity : 0,
              delay: (index % 7) * 0.35,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Ícone 3D ──────────────────────────────────────────────────────────────────

export interface Recap3DIconProps {
  /** Arte 3D opcional (PNG). Se faltar, cai no ícone line atual. */
  src?: string;
  /** Ícone line usado como fallback quando a arte não carrega. */
  fallback: React.ReactNode;
  alt: string;
  accent: string;
  /** Lado do quadro do ícone (px). */
  size?: number;
  /** Lado da arte dentro do quadro (px). */
  artSize?: number;
  className?: string;
}

/**
 * Ícone principal do slide: bloom de LED pulsante, flutuação suave, inclinação
 * 3D seguindo o ponteiro e glare especular. A arte 3D é opcional — se o
 * arquivo não existir, o ícone line original é usado sem quebrar nada.
 */
export function Recap3DIcon({
  src,
  fallback,
  alt,
  accent,
  size = 132,
  artSize = 96,
  className = "",
}: Recap3DIconProps) {
  const reduced = useReducedMotion();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const tilt = useRecapTilt(8);
  const artFailed = Boolean(src) && failedSrc === src;
  const glareBackground = useTransform(
    [tilt.glareX, tilt.glareY],
    ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,.30), transparent 58%)`,
  );

  return (
    <div
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size, perspective: 900 }}
    >
      {/* Bloom de LED */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: size * 1.05,
          height: size * 1.05,
          background: `radial-gradient(circle, ${accent}66 0%, ${accent}22 45%, transparent 70%)`,
          filter: "blur(16px)",
        }}
        animate={reduced ? { opacity: 0.55 } : { scale: [1, 1.14, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Inclinação 3D */}
      <motion.div
        className="relative grid place-items-center"
        style={{
          rotateX: tilt.rotateX,
          rotateY: tilt.rotateY,
          transformStyle: "preserve-3d",
        }}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        onPointerDown={tilt.onPointerDown}
      >
        {/* Flutuação */}
        <motion.div
          className="relative grid place-items-center"
          animate={reduced ? undefined : { y: [0, -7, 0], rotate: [-1.6, 1.6, -1.6] }}
          transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="grid place-items-center rounded-full"
            style={{
              width: size * 0.76,
              height: size * 0.76,
              background: `radial-gradient(circle at 35% 30%, ${accent}38, ${accent}0d)`,
              border: `1px solid ${accent}55`,
              boxShadow: `0 0 30px -8px ${accent}, inset 0 1px 0 rgba(255,255,255,.22)`,
            }}
          >
            {src && !artFailed ? (
              <Image
                src={src}
                alt={alt}
                width={artSize}
                height={artSize}
                onError={() => setFailedSrc(src)}
                style={{ objectFit: "contain" }}
                unoptimized
                draggable={false}
              />
            ) : (
              <span aria-hidden="true" className="grid place-items-center" style={{ color: accent }}>
                {fallback}
              </span>
            )}
          </div>
        </motion.div>

        {/* Glare especular */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: glareBackground,
            opacity: tilt.glareOpacity,
          }}
        />
      </motion.div>
    </div>
  );
}
