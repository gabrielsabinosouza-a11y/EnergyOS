"use client";

import { useCallback, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { TILT } from "@/lib/design-tokens";

/**
 * Mouse-follow 3D tilt for cards. Returns props to spread on the element.
 * Disabled on touch devices and when the user prefers reduced motion.
 * Max rotation ~8deg with a spring-ish return via CSS transition.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const frame = useRef<number | null>(null);

  const canTilt = useCallback(() => {
    if (!enabled || typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (window.matchMedia("(pointer: coarse)").matches) return false;
    return true;
  }, [enabled]);

  const onMouseMove = useCallback((e: MouseEvent<T>) => {
    if (!canTilt() || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setStyle({
        transform: `perspective(${TILT.perspective}px) rotateX(${(-py * TILT.maxDeg).toFixed(2)}deg) rotateY(${(px * TILT.maxDeg).toFixed(2)}deg) scale(${TILT.scale})`,
        transition: "transform 90ms linear",
      });
    });
  }, [canTilt]);

  const onMouseLeave = useCallback(() => {
    setStyle({
      transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)",
      transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)",
    });
  }, []);

  return { ref, style, onMouseMove, onMouseLeave };
}

/** Wrapper component version of useTilt for non-interactive cards. */
export function TiltCard({
  children,
  className,
  style,
  enabled = true,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  enabled?: boolean;
}) {
  const tilt = useTilt<HTMLDivElement>(enabled);
  return (
    <div
      ref={tilt.ref}
      className={className}
      style={{ ...style, ...tilt.style, transformStyle: "preserve-3d" }}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
    >
      {children}
    </div>
  );
}
