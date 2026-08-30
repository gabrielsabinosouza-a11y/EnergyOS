"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { ENERGY_CONFIGS, type EnergyStage, type EnergyType } from "@/lib/energy-assets";

export interface EnergyRingCenterProps {
  energyType: string;
  ringSize: number;
  stage?: EnergyStage;
  dimmed?: boolean;
  onPick?: () => void;
  showCluster?: boolean;
  clusterCount?: number;
}

export function EnergyRingCenter({
  energyType,
  ringSize,
  stage = "spark",
  dimmed = false,
  onPick,
  showCluster = false,
  clusterCount = 1,
}: EnergyRingCenterProps) {
  const reduced = useReducedMotion();
  const cfg = ENERGY_CONFIGS[energyType as EnergyType] || ENERGY_CONFIGS.flame;
  const imageSize = Math.round(ringSize * 0.58);

  const transitionConfig = reduced
    ? { duration: 0.15 }
    : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 2 }}
    >
      {/* Ambient radial glow that updates color with energy */}
      <motion.div
        key={`glow-${energyType}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: imageSize * 0.9,
          height: imageSize * 0.9,
          background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 72%)`,
          filter: "blur(2px)",
        }}
      />

      {/* Centered image container with fixed dimensions to prevent layout shifts */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: imageSize,
          height: imageSize,
          opacity: dimmed ? 0.35 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <AnimatePresence mode="wait">
          {showCluster && clusterCount > 1 ? (
            <motion.div
              key={`cluster-${energyType}-${clusterCount}`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: "blur(4px)" }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: "blur(4px)" }}
              transition={transitionConfig}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              {Array.from({ length: clusterCount }).map((_, i) => {
                const angle = (i / clusterCount) * 2 * Math.PI - Math.PI / 2;
                const r = imageSize * 0.28;
                const sz = Math.round(imageSize * 0.42);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 320, damping: 18 }}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(calc(-50% + ${Math.cos(angle) * r}px), calc(-50% + ${Math.sin(angle) * r}px))`,
                      filter: `drop-shadow(0 0 8px ${cfg.accent})`,
                    }}
                  >
                    <Image
                      src={cfg.assets.full}
                      alt={cfg.label}
                      width={sz}
                      height={sz}
                      style={{ objectFit: "contain" }}
                      unoptimized
                      priority
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key={`${energyType}-${stage}`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: "blur(4px)" }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: "blur(4px)" }}
              transition={transitionConfig}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Image
                src={cfg.assets[stage] || cfg.assets.spark}
                alt={`${cfg.label} ${stage}`}
                width={imageSize}
                height={imageSize}
                style={{ objectFit: "contain", display: "block" }}
                unoptimized
                priority
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Constrained click area for picker button */}
        {onPick && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPick();
            }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer bg-transparent border-none p-0 pointer-events-auto z-10"
            style={{
              width: imageSize * 0.55,
              height: imageSize * 0.55,
            }}
            aria-label="Escolher energia"
          />
        )}
      </div>
    </div>
  );
}
