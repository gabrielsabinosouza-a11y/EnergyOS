"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ENERGY_CONFIGS, mapGrowthStageToEnergyStage, type GardenGrowthStage, type GardenStatus, type EnergyType } from "@/lib/energy-assets";
import type { GardenEntry } from "@/lib/db/focus";

interface IsometricGardenProps {
  entries: GardenEntry[];
  onEntryClick?: (entry: GardenEntry) => void;
  className?: string;
}

export function IsometricGarden({ entries, onEntryClick, className = "" }: IsometricGardenProps) {
  const { grid, cols } = useMemo(() => {
    // Keep the garden compact and aligned with the list view.
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const targetCols = isMobile ? 3 : 5;
    const cols = Math.min(targetCols, Math.max(1, Math.ceil(Math.sqrt(entries.length))));

    // Arrange entries in grid order (left to right, top to bottom)
    const grid = entries.map((entry, index) => ({
      entry,
      row: Math.floor(index / cols),
      col: index % cols,
    }));

    return { grid, cols };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
        <div className="text-4xl">🌱</div>
        <p className="text-sm text-[var(--text-muted)]">Seu jardim está vazio</p>
        <p className="text-xs text-[var(--text-faint)]">Complete uma sessão de foco para plantar sua primeira energia</p>
      </div>
    );
  }

  return (
    <div className={`isometric-garden ${className}`}>
      <div
        className="isometric-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "8px",
          transform: "rotateX(60deg) rotateZ(-45deg)",
          transformStyle: "preserve-3d",
          perspective: "1000px",
        }}
      >
        {grid.map(({ entry, row, col }) => {
          const cfg = ENERGY_CONFIGS[entry.energyType as EnergyType];
          if (!cfg) {
            if (process.env.NODE_ENV !== "production") {
              throw new Error(`Unknown garden energy type: ${entry.energyType}`);
            }
            return null;
          }
          const energyStage = mapGrowthStageToEnergyStage(entry.growthStage, entry.status);
          const isWithered = entry.status === "withered";
          const isGrowing = entry.status === "growing";

          // Calculate visual properties based on growth stage
          const sizeMultiplier = entry.growthStage === "mature" ? 1.2 : entry.growthStage === "young" ? 1.0 : 0.7;
          const opacity = isWithered ? 0.4 : isGrowing ? 0.7 : 1.0;
          const filter = isWithered ? "grayscale(100%) brightness(0.7)" : "none";

          // Stagger animation based on position
          const delay = (row * cols + col) * 0.05;

          return (
            <motion.div
              key={entry.id}
              className="garden-tile"
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay,
                type: "spring",
                stiffness: 260,
                damping: 20
              }}
              style={{
                position: "relative",
                aspectRatio: "1",
                overflow: "visible",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: onEntryClick ? "pointer" : "default",
              }}
              onClick={() => onEntryClick?.(entry)}
            >
              {/* Tile base */}
              <div
                className="tile-base"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isWithered
                    ? "linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)"
                    : `linear-gradient(135deg, ${cfg.glow}22 0%, ${cfg.glow}11 100%)`,
                  borderRadius: "8px",
                  transform: "translateZ(-20px)",
                  boxShadow: isWithered
                    ? "0 4px 8px rgba(0,0,0,0.3)"
                    : `0 8px 16px ${cfg.glow}44`,
                  border: isWithered
                    ? "1px solid #3a3a3a"
                    : `1px solid ${cfg.accent}44`,
                }}
              />

              {/* Plant/energy */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: "20%",
                  width: "58%",
                  height: "18%",
                  borderRadius: "50%",
                  background: "rgba(0, 0, 0, 0.38)",
                  filter: "blur(4px)",
                  transform: "translateZ(2px)",
                }}
              />
              <motion.div
                className="plant-container"
                animate={isGrowing ? {
                  scale: [1, 1.05, 1],
                  opacity: [0.7, 0.8, 0.7]
                } : {}}
                transition={isGrowing ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
                style={{
                  position: "relative",
                  width: "76%",
                  height: "76%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // The tile is isometric; cancel that transform for the
                  // artwork so the energy stands upright above its shadow.
                  transform: `rotateZ(45deg) rotateX(-60deg) translateY(-18px) translateZ(28px) scale(${sizeMultiplier})`,
                  opacity,
                  filter,
                }}
              >
                <Image
                  src={cfg.assets[energyStage]}
                  alt={cfg.label}
                  fill
                  style={{ objectFit: "contain", maxHeight: "100%" }}
                  unoptimized
                />
              </motion.div>

              {/* Growth indicator for growing plants */}
              {isGrowing && (
                <motion.div
                  className="growth-indicator"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: cfg.accent,
                    boxShadow: `0 0 8px ${cfg.accent}`,
                  }}
                />
              )}

              {/* Withered indicator */}
              {isWithered && (
                <div
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    fontSize: "12px",
                  }}
                >
                  🥀
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}