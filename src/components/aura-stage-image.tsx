"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { auraStageImageCandidates } from "@/lib/aura-images";
import type { EnergyConfig } from "@/lib/energy-assets";
import type { TimerGrowthStage } from "@/lib/focus-growth";

export interface AuraStageImageProps {
  auraId: string;
  /** New naming: begin/mid/full; plus die (dead, e.g. gave-up garden entries). */
  stage: TimerGrowthStage | "die";
  /** Resolved aura config; defaults to the built-in one. */
  cfg?: EnergyConfig;
  /** Alt text; defaults to "{auraId} {stage}". */
  label?: string;
  /** Wrapper size in px (width & height). */
  size?: number;
  /** Extra wrapper styles (drop-shadows, margins, sizing overrides). */
  style?: React.CSSProperties;
  /** Bump to replay the entrance animation (shake on die). */
  enterKey?: number | string;
}

const DIE_FILTER = "grayscale(100%) brightness(0.55)";

/**
 * Renders the stage image of an aura. The {auraId}_{stage}.png asset is tried
 * first; when it is missing the aura's legacy icon from ENERGY_CONFIGS is
 * used instead, so a missing image never breaks the UI. On die, the image is
 * desaturated (grayscale + lower opacity), matching the garden's dead style.
 */
export function AuraStageImage({
  auraId,
  stage,
  cfg,
  label,
  size = 140,
  style,
  enterKey = 0,
}: AuraStageImageProps) {
  const reduced = useReducedMotion() ?? false;
  const candidates = useMemo(() => auraStageImageCandidates(auraId, stage, cfg), [auraId, stage, cfg]);
  const [src, setSrc] = useState<string | null>(null);
  const [entrance, setEntrance] = useState(0);

  // Probes candidates in order: renders the first that loads, falling back to
  // the aura's legacy icon when a stage image is missing. Ends as nothing
  // rather than an error if none of them resolve.
  useEffect(() => {
    setSrc(null);
    let cancelled = false;
    const probe = (index: number): void => {
      if (cancelled || index >= candidates.length) return;
      const img = new window.Image();
      img.onload = () => {
        if (!cancelled) setSrc(candidates[index]);
      };
      img.onerror = () => probe(index + 1);
      img.src = candidates[index];
    };
    probe(0);
    return () => { cancelled = true; };
  }, [candidates]);

  // Each stage change remounts the wrapper: crossfade + scale pop (shake on
  // die). Reduced motion → plain fade, no shakes.
  useEffect(() => { setEntrance(e => e + 1); }, [stage, auraId, enterKey]);

  const isDie = stage === "die";

  return (
    <motion.div
      key={entrance}
      className="flex items-center justify-center"
      style={{ width: size, height: size, position: "relative", ...style }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={isDie && !reduced ? { opacity: 1, rotate: [0, 2.5, -2.5, 2.5, -2.5, 0] } : { opacity: 1, scale: 1 }}
      transition={isDie && !reduced ? { type: "tween", duration: 0.45, ease: "easeOut" } : { type: "spring", stiffness: 320, damping: 18 }}
    >
      {src && (
        <AnimatePresence mode="sync">
          <motion.img
            key={src}
            src={src}
            alt={label ?? `${auraId} ${stage}`}
            draggable={false}
            width={size}
            height={size}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "tween", duration: reduced ? 0.1 : 0.2, ease: "easeOut" }}
            style={{ objectFit: "contain", display: "block", filter: isDie ? DIE_FILTER : undefined }}
          />
        </AnimatePresence>
      )}
    </motion.div>
  );
}

/** Small burst of sparkles around a stage change (growth / completion). */
export function StageBurst({ kind }: { kind: "small" | "big" }) {
  const reduced = useReducedMotion() ?? false;
  if (reduced) return null;
  const count = kind === "big" ? 14 : 7;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [1, 0.35, 0], scale: [0.8, 1.8, 0.6] }}
          transition={{
            duration: kind === "big" ? 0.95 : 0.65,
            delay: i * (kind === "big" ? 0.1 : 0.07),
            ease: "easeOut",
            times: [0, 0.6, 1],
          }}
        />
      ))}
    </span>
  );
}
