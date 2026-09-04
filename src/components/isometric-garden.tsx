"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ENERGY_CONFIGS, mapGrowthStageToEnergyStage, type EnergyType } from "@/lib/energy-assets";
import type { GardenEntry } from "@/lib/db/focus";

interface IsometricGardenProps {
  entries: GardenEntry[];
  onEntryClick?: (entry: GardenEntry) => void;
  className?: string;
}

const TILE_WIDTH = 116;
const TILE_HEIGHT = 78;
const X_STEP = TILE_WIDTH / 2;
const Y_STEP = TILE_HEIGHT / 2;
const ICON_SIZE = 54;

export function IsometricGarden({ entries, onEntryClick, className = "" }: IsometricGardenProps) {
  const layout = useMemo(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const cols = Math.min(isMobile ? 3 : 5, Math.max(1, Math.ceil(Math.sqrt(entries.length))));
    const rows = Math.ceil(entries.length / cols);
    const span = rows + cols - 2;

    return {
      cols,
      rows,
      width: span * X_STEP + TILE_WIDTH,
      height: span * Y_STEP + TILE_HEIGHT,
      items: entries.map((entry, index) => ({
        entry,
        row: Math.floor(index / cols),
        col: index % cols,
      })),
    };
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
    <div
      className={`panel w-full overflow-auto p-3 sm:p-5 ${className}`}
      style={{ maxHeight: "min(62vh, 560px)" }}
    >
      <div
        className="relative mx-auto"
        style={{
          width: layout.width,
          height: layout.height,
          minWidth: "100%",
        }}
      >
        {layout.items.map(({ entry, row, col }, index) => {
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
          const left = (col - row) * X_STEP + (layout.rows - 1) * X_STEP;
          const top = (col + row) * Y_STEP;
          const delay = index * 0.04;

          return (
            <motion.button
              key={entry.id}
              type="button"
              aria-label={`${cfg.label} — ${entry.durationMinutes} minutos`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
              className="absolute border-0 bg-transparent p-0"
              style={{
                left,
                top,
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
                cursor: onEntryClick ? "pointer" : "default",
                zIndex: row + col + 1,
              }}
              onClick={() => onEntryClick?.(entry)}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  background: isWithered
                    ? "linear-gradient(135deg, #4a4a4a, #292929)"
                    : `linear-gradient(135deg, ${cfg.glow}66, ${cfg.glow}18)`,
                  border: `1px solid ${isWithered ? "#555" : cfg.accent}66`,
                  boxShadow: `0 8px 16px ${isWithered ? "rgba(0,0,0,.28)" : cfg.glow}`,
                }}
              />

              <span
                aria-hidden="true"
                className="absolute rounded-[50%]"
                style={{
                  left: "25%",
                  bottom: "14%",
                  width: "50%",
                  height: 9,
                  background: "rgba(0, 0, 0, .42)",
                  filter: "blur(4px)",
                }}
              />

              <motion.span
                aria-hidden="true"
                className="absolute left-1/2 flex items-end justify-center"
                animate={isGrowing ? { scale: [1, 1.04, 1] } : undefined}
                transition={isGrowing ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
                style={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  left: `calc(50% - ${ICON_SIZE / 2}px)`,
                  bottom: "18%",
                  transform: "translateY(-18px)",
                  opacity: isWithered ? 0.45 : isGrowing ? 0.75 : 1,
                  filter: isWithered ? "grayscale(100%) brightness(.7)" : "none",
                }}
              >
                {/* Fixed bounds keep source canvases, including Flame, visually consistent. */}
                <img
                  src={cfg.assets[energyStage]}
                  alt=""
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </motion.span>

              {isGrowing && (
                <span
                  aria-hidden="true"
                  className="absolute right-[18%] top-[18%] h-2.5 w-2.5 rounded-full"
                  style={{ background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
