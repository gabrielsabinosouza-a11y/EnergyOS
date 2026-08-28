"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ENERGY_CONFIGS, type EnergyStage, type EnergyType } from "@/lib/energy-assets";

interface EnergyRingCenterProps {
  energyType: string;
  ringSize: number;
  stage?: EnergyStage;
  dimmed?: boolean;
  onPick?: () => void;
}

export function EnergyRingCenter({
  energyType,
  ringSize,
  stage = "spark",
  dimmed = false,
  onPick,
}: EnergyRingCenterProps) {
  const cfg = ENERGY_CONFIGS[energyType as EnergyType] || ENERGY_CONFIGS.flame;
  const imageSize = Math.round(ringSize * 0.55);

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          width: imageSize * 0.9,
          height: imageSize * 0.9,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 72%)`,
          filter: "blur(2px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: imageSize, height: imageSize, opacity: dimmed ? 0.35 : 1 }}>
        <motion.div
          key={`${energyType}-${stage}`}
          initial={{ opacity: 0, scale: 0.88, filter: "blur(6px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ pointerEvents: "none" }}
        >
          <Image
            src={cfg.assets[stage]}
            alt={cfg.label}
            width={imageSize}
            height={imageSize}
            style={{ objectFit: "contain", display: "block" }}
            unoptimized
            priority
          />
        </motion.div>
        {onPick && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPick();
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: imageSize * 0.55,
              height: imageSize * 0.55,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              borderRadius: "50%",
              pointerEvents: "auto",
            }}
            aria-label="Escolher energia"
          />
        )}
      </div>
    </div>
  );
}
