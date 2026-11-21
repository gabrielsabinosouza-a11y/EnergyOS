"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";

/*
 * TourHeroStage — premium 3D stage for tour/onboarding hero art.
 *
 * Layers (back → front): accent glow → rotating LED ring → floating glass
 * orb with the art → drifting sparkles → soft elliptical shadow. Pointer
 * tilt uses springs so motion never feels abrupt; disabled on touch devices
 * and under prefers-reduced-motion.
 */

const SPARKLE_COUNT = 9;

export function LedRing({ accent, size }: { accent: string; size: number }) {
  const gradient = `conic-gradient(from 0deg, ${accent}, #67e8f9, #a78bfa, ${accent})`;
  return (
    <>
      {/* blurred bloom copy for the LED glow */}
      <div
        aria-hidden
        className="tour-led-bloom"
        style={{ width: size, height: size, background: gradient } as CSSProperties}
      />
      <div
        aria-hidden
        className="tour-led-ring"
        style={{ width: size, height: size, background: gradient } as CSSProperties}
      />
    </>
  );
}

function Sparkles({ accent }: { accent: string }) {
  const dots = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
    id: i,
    x: (i * 37) % 100,
    y: (i * 53) % 100,
    size: 2 + ((i * 7) % 4),
    duration: 2.6 + ((i * 13) % 30) / 10,
    delay: -((i * 17) % 20) / 10,
  }));
  return (
    <div className="tour-sparkles" aria-hidden>
      {dots.map((d) => (
        <span
          key={d.id}
          className="tour-sparkle"
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              background: accent,
              boxShadow: `0 0 6px ${accent}`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

interface TourHeroStageProps {
  src?: string;
  icon?: ReactNode;
  accent?: string;
  alt?: string;
  /** Disable pointer tilt and idle motion (touch / reduced-motion). */
  static?: boolean;
}

export function TourHeroStage({ src, icon, accent = "#60a5fa", alt = "", static: isStatic }: TourHeroStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Lazy init is safe: finePointer only gates pointer handlers, never markup.
  const [finePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );
  const [orbSize, setOrbSize] = useState(120);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 140, damping: 16 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 140, damping: 16 });
  const parX = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 140, damping: 16 });
  const parY = useSpring(useTransform(my, [-0.5, 0.5], [-10, 10]), { stiffness: 140, damping: 16 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOrbSize(Math.max(96, Math.min(150, el.clientWidth * 0.6))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onPointerMove(e: React.PointerEvent) {
    if (isStatic || !finePointer) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function onPointerLeave() {
    mx.set(0);
    my.set(0);
  }

  const interactive = !isStatic && finePointer;
  const ledSize = orbSize * 1.22;

  return (
    <div
      ref={ref}
      className="tour-stage"
      style={{ "--tour-accent": accent } as CSSProperties}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerLeave={interactive ? onPointerLeave : undefined}
    >
      {/* idle float wrapper — owns y only so pointer tilt never fights it */}
      <motion.div
        className="tour-stage-float"
        animate={isStatic ? undefined : { y: [0, -6, 0] }}
        transition={isStatic ? undefined : { duration: 3.6, ease: "easeInOut", repeat: Infinity }}
      >
        {/* soft elliptical shadow under the orb */}
        <motion.div
          className="tour-stage-shadow"
          style={{ width: orbSize * 1.2, translateX: parX, translateY: parY }}
          animate={isStatic ? undefined : { scaleX: [1, 0.9, 1], opacity: [0.55, 0.38, 0.55] }}
          transition={isStatic ? undefined : { duration: 3.6, ease: "easeInOut", repeat: Infinity }}
        />

        {/* pointer-tilt layer (preserve-3d) */}
        <motion.div
          className="tour-stage-tilt"
          style={{
            rotateX: isStatic ? 0 : rotateX,
            rotateY: isStatic ? 0 : rotateY,
            transformStyle: "preserve-3d",
          }}
        >
          {/* back layer: accent glow blob (parallax) */}
          <motion.div
            className="tour-stage-glow"
            style={{
              width: orbSize * 1.8,
              height: orbSize * 1.8,
              translateX: parX,
              translateY: parY,
              background: `radial-gradient(circle, ${accent}59 0%, transparent 65%)`,
            }}
          />

          {/* LED ring + glass pedestal/orb */}
          <div className="tour-stage-led" style={{ width: ledSize, height: ledSize }}>
            <LedRing accent={accent} size={ledSize} />
          </div>
          <div
            className="tour-stage-orb"
            style={{
              width: orbSize,
              height: orbSize,
              background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.14), rgba(255,255,255,.03) 55%, rgba(10,14,26,.35)), linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.02))`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,.18), 0 14px 34px -10px ${accent}55`,
            }}
          >
            {src ? (
              <Image
                src={src}
                alt={alt}
                width={orbSize}
                height={orbSize}
                unoptimized
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <span className="text-[var(--tour-accent)]">{icon}</span>
            )}
          </div>

          {/* front layer: sparkles (parallax) */}
          <motion.div className="tour-stage-sparkles-wrap" style={{ translateX: parX, translateY: parY }}>
            <Sparkles accent={accent} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
