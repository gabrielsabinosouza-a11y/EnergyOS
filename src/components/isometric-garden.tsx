"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ENERGY_CONFIGS, mapGrowthStageToEnergyStage, type EnergyType } from "@/lib/energy-assets";
import type { GardenEntry } from "@/lib/db/focus";

interface IsometricGardenProps {
  entries: GardenEntry[];
  onEntryClick?: (entry: GardenEntry) => void;
  className?: string;
}

// ── Terrain metrics ───────────────────────────────────────────────────────────
/** Padding interno do grid (espaço entre a borda do terreno e as plantas). */
const GRID_PAD = 16;
/** Cap do lado do terreno quadrado em desktop (encolhe naturalmente em telas menores). */
const TERRAIN_MAX = 748;
/** Largura base de referência para as decorações (glow, sombra, patch). */
const ICON_BASE = 58;
/** Piso mínimo de tamanho de célula. Abaixo disso as plantas começarían a se superpor. */
const MIN_CELL = 8;
/** Acima deste nº de itens ativa o modo denso: fade único do container, sem springs por item. */
const DENSE_THRESHOLD = 25;

/** Hash determinístico → 0..1. Dá jitter estável entre renders/SSR, sem Math.random. */
function hash01(seed: number): number {
  let h = (seed + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

export function IsometricGarden({ entries, onEntryClick, className = "" }: IsometricGardenProps) {
  const terrainRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(748);

  useEffect(() => {
    const el = terrainRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setAvailableWidth(Math.max(1, avail));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A API entrega as entradas em ordem decrescente; invertemos para que as
  // energias mais recentes fiquem nas linhas de baixo — primeiro plano do terreno.
  const planted = useMemo(
    () => [...entries].sort((a, b) => new Date(a.plantedAt).getTime() - new Date(b.plantedAt).getTime()),
    [entries],
  );

  const reduced = useReducedMotion() ?? false;
  const n = planted.length;

  // ── Densidade dinámica (Forest-style) ───────────────────────────────────────
  // O terreno é um quadrado fixo (aspect-ratio 1/1) que nunca rola. A grade deriva
  // do nº de plantas (columns/rows ≈ ceil(sqrt(n))) e cada célula encolhe de forma
  // inversa à densidade para que tudo caiba sempre dentro do quadrado.
  const containerSize = Math.max(1, Math.min(TERRAIN_MAX, availableWidth));
  const columns = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / columns));
  const usableSize = Math.max(1, containerSize - GRID_PAD * 2);
  const cellSize = Math.max(MIN_CELL, usableSize / Math.max(columns, rows));
  // Escala de decorações: ficam a tamanho base em células grandes e encolhen junto
  // com a densidade para não estorbar ao compactar muitas plantas.
  const dec = Math.min(1, cellSize / ICON_BASE);
  // Modo denso: sem springs/motion por item — o container inteiro faz um único
  // fade-in e as plantas ficam estáticas (hover via CSS) para não travar em densidades altas.
  const dense = n > DENSE_THRESHOLD;
  const animate = !dense && !reduced;

  // Partículas ambientais — poucas, leves e determinísticas (animadas via CSS).
  const particles = useMemo(() => {
    const n = Math.min(14, Math.max(7, Math.round(planted.length / 2)));
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      left: 6 + hash01(i * 31 + 7) * 86,
      top: 14 + hash01(i * 57 + 11) * 66,
      size: 2 + Math.round(hash01(i * 83 + 3)),
      duration: 7 + hash01(i * 97 + 5) * 7,
      delay: -(hash01(i * 113 + 9) * 14),
      tone: i % 3,
    }));
  }, [planted.length]);

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
      className={`panel overflow-hidden p-3 sm:p-5 ${className}`}
    >
      {/* Terreno único: uma "clareira" iluminada ao centro, escurecendo até as bordas. */}
      <motion.div
        className="relative mx-auto overflow-hidden rounded-[26px]"
        initial={dense && !reduced ? { opacity: 0 } : false}
        animate={dense && !reduced ? { opacity: 1 } : undefined}
        transition={{ duration: 0.35 }}
        style={{
          width: "100%",
          maxWidth: containerSize,
          aspectRatio: "1 / 1",
          background: [
            "radial-gradient(120% 85% at 50% 10%, rgba(113,212,255,0.07) 0%, rgba(113,212,255,0) 55%)",
            "radial-gradient(90% 78% at 50% 42%, #262d21 0%, #1c2218 52%, #11150e 100%)",
          ].join(", "),
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,0.08)",
            "inset 0 -26px 44px -26px rgba(0,0,0,0.72)",
            "inset 0 26px 44px -30px rgba(0,0,0,0.5)",
            "0 20px 44px -20px rgba(0,0,0,0.6)",
          ].join(", "),
        }}
      >
        {/* Manchas orgânicas de musgo/luz — textura do território, não uma grade. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(38% 30% at 16% 74%, rgba(110,231,183,0.05) 0%, transparent 70%)",
              "radial-gradient(30% 26% at 82% 66%, rgba(110,231,183,0.04) 0%, transparent 70%)",
              "radial-gradient(26% 22% at 64% 20%, rgba(113,212,255,0.035) 0%, transparent 72%)",
              "radial-gradient(22% 20% at 32% 28%, rgba(255,214,143,0.03) 0%, transparent 72%)",
            ].join(", "),
          }}
        />

        {/* Vinheta: a luz do jardim decai suavemente para as bordas. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(105% 100% at 50% 36%, transparent 56%, rgba(0,0,0,0.4) 100%)",
          }}
        />

        {/* Rim de terra na base — o canteiro tem "solo", não flutua. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: "15%",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(56,40,24,0.22) 72%, rgba(44,31,19,0.36) 100%)",
          }}
        />

        {/* Partículas flutuantes — o jardim respira. */}
        {particles.map((p) => (
          <span
            key={`particle-${p.id}`}
            aria-hidden="true"
            className="garden-float pointer-events-none absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              opacity: 0.45,
              background:
                p.tone === 0
                  ? "rgba(110,231,183,0.55)"
                  : p.tone === 1
                    ? "rgba(113,212,255,0.5)"
                    : "rgba(255,214,143,0.45)",
              boxShadow: "0 0 6px rgba(255,255,255,0.16)",
              animationDuration: `${p.duration.toFixed(2)}s`,
              animationDelay: `${p.delay.toFixed(2)}s`,
            }}
          />
        ))}

        <div
          className="absolute inset-0 grid justify-items-center"
          style={{
            padding: GRID_PAD,
            placeContent: "center",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridAutoRows: `${cellSize}px`,
          }}
        >
        {planted.map((entry, index) => {
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
          // Viva em nível máximo (forma completa + sessão concluída) → ganha aura pulsante.
          const isFullLife = entry.status === "alive" && energyStage === "full";

          const icon = cellSize;
          const delay = index * 0.035;

          const sharedProps = {
            type: "button" as const,
            "aria-label": `${cfg.label} — ${entry.durationMinutes} minutos`,
            className: "relative flex items-center justify-center border-0 bg-transparent p-0",
            style: {
              width: "100%",
              height: cellSize,
              zIndex: 10 + index,
              cursor: onEntryClick ? "pointer" : "default",
            },
            onClick: () => onEntryClick?.(entry),
          };

          const spriteStyle = {
            width: icon,
            height: icon,
            opacity: isWithered ? 0.45 : isGrowing ? 0.9 : 1,
            filter: isWithered
              ? "grayscale(100%) brightness(.7)"
              : `drop-shadow(0 10px 7px rgba(0,0,0,0.45)) drop-shadow(0 0 10px ${cfg.glow})`,
          };

          const spriteImg = (
            <img
              src={cfg.assets[energyStage]}
              alt=""
              width={Math.round(icon)}
              height={Math.round(icon)}
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          );

          const content = (
            <>
              {/* Aura pulsante — apenas energias vivas em nível máximo "respiram". */}
              {isFullLife && (
                <span
                  aria-hidden="true"
                  className="garden-breathe pointer-events-none absolute rounded-full"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: 92 * dec,
                    height: 62 * dec,
                    opacity: 0.4,
                    background: `radial-gradient(50% 50% at 50% 50%, ${cfg.glow} 0%, transparent 72%)`,
                    animationDelay: `${((entry.id % 8) * 0.5).toFixed(2)}s`,
                  }}
                />
              )}

              {/* Patch de luz orgânico no chão — substitui o diamante rígido da grade. */}
              <span
                aria-hidden="true"
                className="absolute rounded-[50%]"
                style={{
                  left: "50%",
                  top: "50%",
                  width: 64 * dec,
                  height: 21 * dec,
                  transform: "translate(-50%, -50%)",
                  background: isWithered
                    ? "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 75%)"
                    : `radial-gradient(50% 50% at 50% 50%, ${cfg.glow}77 0%, transparent 75%)`,
                }}
              />

              {/* Sombra de contato — dá peso/3D a cada energia. */}
              <span
                aria-hidden="true"
                className="absolute rounded-[50%]"
                style={{
                  left: "50%",
                  bottom: 6 * dec,
                  width: 46 * dec,
                  height: 9 * dec,
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.5)",
                  filter: "blur(4px)",
                }}
              />

              {/* A energia: drop-shadow atrás (profundidade) + glow suave da própria cor. */}
              {isGrowing && animate ? (
                <motion.span
                  aria-hidden="true"
                  className="relative flex items-end justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={spriteStyle}
                >
                  {spriteImg}
                </motion.span>
              ) : (
                <span aria-hidden="true" className="relative flex items-end justify-center" style={spriteStyle}>
                  {spriteImg}
                </span>
              )}
            </>
          );

          return animate ? (
            <motion.button
              key={entry.id}
              {...sharedProps}
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
            >
              {content}
            </motion.button>
          ) : (
            <button
              key={entry.id}
              {...sharedProps}
              className="relative flex items-center justify-center border-0 bg-transparent p-0 transition-transform duration-200 hover:-translate-y-1"
            >
              {content}
            </button>
          );
        })}
        </div>
      </motion.div>
    </div>
  );
}
