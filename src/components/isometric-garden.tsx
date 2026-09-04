"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ENERGY_CONFIGS, mapGrowthStageToEnergyStage, type EnergyType } from "@/lib/energy-assets";
import type { GardenEntry } from "@/lib/db/focus";

interface IsometricGardenProps {
  entries: GardenEntry[];
  onEntryClick?: (entry: GardenEntry) => void;
  className?: string;
}

const TILE_W = 96;
const TILE_H = 68;
const X_STEP = 102;
const Y_STEP = 50;
const PAD_X = 30;
const PAD_Y = 26;

/** Quantas plantas por linha cabem na largura disponível do terreno. */
function columnsForWidth(width: number): number {
  if (width >= 640) return 6;
  if (width >= 520) return 5;
  if (width >= 400) return 4;
  return 3;
}

export function IsometricGarden({ entries, onEntryClick, className = "" }: IsometricGardenProps) {
  const terrainRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);

  useEffect(() => {
    const el = terrainRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setCols(columnsForWidth(avail));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const terrainWidth = useMemo(() => cols * X_STEP - 6 + PAD_X * 2, [cols]);

  const rows = Math.max(1, Math.ceil(entries.length / cols));
  const terrainHeight = Math.max(180, (rows - 1) * Y_STEP + TILE_H + PAD_Y * 2);

  const slots = useMemo(() => entries.map((entry, index) => ({ entry, index })), [entries]);

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
      ref={terrainRef}
      className={`panel overflow-y-auto overflow-x-hidden p-3 sm:p-5 ${className}`}
      style={{ maxHeight: "min(62vh, 560px)" }}
    >
      <div
        className="relative mx-auto overflow-hidden rounded-2xl"
        style={{
          width: "100%",
          maxWidth: terrainWidth,
          height: terrainHeight,
          background:
            "linear-gradient(180deg, #23271f 0%, #1d211a 45%, #161a14 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.06), inset 0 -18px 28px -18px rgba(0,0,0,0.6)",
        }}
      >
        {/* Faint grid of the terrain plots */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
            backgroundSize: `${X_STEP}px ${Y_STEP * 2}px`,
          }}
        />

        {slots.map(({ entry, index }) => {
          const cfg = ENERGY_CONFIGS[entry.energyType as EnergyType];
          if (!cfg) {
            if (process.env.NODE_ENV !== "production") {
              throw new Error(`Unknown garden energy type: ${entry.energyType}`);
            }
            return null;
          }

          const row = Math.floor(index / cols);
          const col = index % cols;
          const energyStage = mapGrowthStageToEnergyStage(entry.growthStage, entry.status);
          const isWithered = entry.status === "withered";
          const isGrowing = entry.status === "growing";
          const left = PAD_X + col * X_STEP;
          const top = PAD_Y + row * Y_STEP;
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
                width: TILE_W,
                height: TILE_H,
                cursor: onEntryClick ? "pointer" : "default",
              }}
              onClick={() => onEntryClick?.(entry)}
            >
              {/* Diamond plot */}
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  background: isWithered
                    ? "linear-gradient(135deg, #4a4a4a, #292929)"
                    : isGrowing
                      ? `linear-gradient(135deg, ${cfg.glow}, ${cfg.glow}26)`
                      : `linear-gradient(135deg, ${cfg.glow}88, ${cfg.glow}26)`,
                  border: `1px solid ${isWithered ? "#555" : cfg.accent}88`,
                  boxShadow: `0 8px 16px ${isWithered ? "rgba(0,0,0,.28)" : `${cfg.glow}55`}`,
                }}
              />

              {/* Ground shadow */}
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
                animate={isGrowing ? { scale: [1, 1.06, 1] } : undefined}
                transition={isGrowing ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
                style={{
                  width: 56,
                  height: 56,
                  left: "calc(50% - 28px)",
                  bottom: "16%",
                  transform: "translateY(-18px)",
                  opacity: isWithered ? 0.45 : isGrowing ? 0.8 : 1,
                  filter: isWithered ? "grayscale(100%) brightness(.7)" : "none",
                }}
              >
                <img
                  src={cfg.assets[energyStage]}
                  alt=""
                  width={56}
                  height={56}
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </motion.span>

              {isGrowing && (
                <span
                  aria-hidden="true"
                  className="absolute right-[16%] top-[16%] h-2.5 w-2.5 rounded-full"
                  style={{ background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }}
                />
              )}
            </motion.button>
          );
        })}

        {/* Empty plots fill the last row so the terrain looks like a cohesive bed */}
        {Array.from({ length: cols * rows - entries.length }).map((_, i) => {
          const index = entries.length + i;
          const row = Math.floor(index / cols);
          const col = index % cols;
          return (
            <span
              key={`empty-${index}`}
              aria-hidden="true"
              className="absolute"
              style={{
                left: PAD_X + col * X_STEP,
                top: PAD_Y + row * Y_STEP,
                width: TILE_W,
                height: TILE_H,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.07)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}