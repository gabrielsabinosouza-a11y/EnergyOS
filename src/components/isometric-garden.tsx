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
const TILE_W = 96;
const TILE_H = 68;
const X_STEP = 104;
const Y_STEP = 54;
const PAD_X = 36;
const PAD_Y = 30;
/** Meia-célula: linhas alternadas deslocadas — empacotamento orgânico, sem colunas rígidas. */
const STAGGER_X = X_STEP / 2;

// ── Density scaling (Forest-style) ────────────────────────────────────────────
// O terreno mantém altura fixa; gridScale encolhe passos e sprites conforme o nº
// de itens cresce, para o jardim inteiro caber sem rolagem no caso normal.
/** Largura base do sprite de energia (na densidade mínima). */
const ICON_BASE = 58;
/** Menor tamanho legível do sprite. Abaixo disso o terreno estoura o cap e a rolagem assume. */
const MIN_ICON = 24;
/** Altura-alvo fixa do terreno (mantida dentro do cap de 640px do invólucro). */
const TERRAIN_H_TARGET = 560;
/** Fator máximo de profundidade por linha — evita que linhas distantes "zoomen" com muitas linhas. */
const MAX_DEPTH = 1.06;
/** Acima deste nº de itens ativa o modo denso: fade único do container, sem springs por item. */
const DENSE_THRESHOLD = 25;

/** Quantas plantas por linha cabem na largura disponível do terreno. */
function columnsForWidth(width: number): number {
  if (width >= 660) return 6;
  if (width >= 540) return 5;
  if (width >= 420) return 4;
  return 3;
}

/** Hash determinístico → 0..1. Dá jitter estável entre renders/SSR, sem Math.random. */
function hash01(seed: number): number {
  let h = (seed + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/** Escala base por estágio visual — brotos menores, forma máxima em destaque. */
const STAGE_SCALE: Record<string, number> = { spark: 0.82, forming: 0.92, full: 1, extinguished: 0.88 };

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

  // A API entrega as entradas em ordem decrescente; invertemos para que as
  // energias mais recentes fiquem nas linhas de baixo — primeiro plano do terreno.
  const planted = useMemo(
    () => [...entries].sort((a, b) => new Date(a.plantedAt).getTime() - new Date(b.plantedAt).getTime()),
    [entries],
  );

  const reduced = useReducedMotion() ?? false;
  const n = planted.length;

  // Altura "natural" (escala 1) da grade; gridScale reduz passos/sprites para
  // caberem todos no terreno de altura fixa.
  const rows = Math.max(1, Math.ceil(n / cols));
  const baseH = (rows - 1) * Y_STEP + TILE_H + PAD_Y * 2;
  const s = Math.min(1, (TERRAIN_H_TARGET - 24) / baseH);
  // Nunca abaixo do mínimo legível. Se o mínimo for atingido, o terreno cresce
  // além do cap e o overflow-y-auto do invólucro assume (fallback raro).
  const gridScale = Math.max(s, MIN_ICON / ICON_BASE);
  const terrainWidth = (cols * X_STEP + STAGGER_X + PAD_X * 2) * gridScale;
  const terrainHeight = Math.max(200, baseH * gridScale + 24);
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
      className={`panel overflow-y-auto overflow-x-hidden p-3 sm:p-5 ${className}`}
      style={{ maxHeight: "min(72vh, 640px)" }}
    >
      {/* Terreno único: uma "clareira" iluminada ao centro, escurecendo até as bordas. */}
      <motion.div
        className="relative mx-auto overflow-hidden rounded-[26px]"
        initial={dense && !reduced ? { opacity: 0 } : false}
        animate={dense && !reduced ? { opacity: 1 } : undefined}
        transition={{ duration: 0.35 }}
        style={{
          width: "100%",
          maxWidth: terrainWidth,
          height: terrainHeight,
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

        {planted.map((entry, index) => {
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
          // Viva em nível máximo (forma completa + sessão concluída) → ganha aura pulsante.
          const isFullLife = entry.status === "alive" && energyStage === "full";

          // Tudo escala junto com a densidade (gridScale) para caber no terreno fixo.
          const jx = (hash01(entry.id * 17 + 1) - 0.5) * 18 * gridScale;
          const jy = (hash01(entry.id * 29 + 2) - 0.5) * 10 * gridScale;
          // Profundidade por linha é limitada: com muitas linhas o antigo "zoom ao
          // fundo" deixaria plantas distantes maiores que as do primeiro plano.
          const depth = Math.min(1 + row * 0.014, MAX_DEPTH);
          const plantScale =
            (STAGE_SCALE[energyStage] ?? 1) * depth * (0.95 + hash01(entry.id * 41 + 4) * 0.1);

          const left = PAD_X * gridScale + col * X_STEP * gridScale + (row % 2 === 1 ? STAGGER_X * gridScale : 0) + jx;
          const top = PAD_Y * gridScale + row * Y_STEP * gridScale + jy;
          const icon = ICON_BASE * gridScale * plantScale;
          const delay = index * 0.035;

          const sharedProps = {
            type: "button" as const,
            "aria-label": `${cfg.label} — ${entry.durationMinutes} minutos`,
            className: "absolute border-0 bg-transparent p-0",
            style: {
              left,
              top,
              width: TILE_W * gridScale,
              height: TILE_H * gridScale,
              zIndex: 10 + row,
              cursor: onEntryClick ? "pointer" : "default",
            },
            onClick: () => onEntryClick?.(entry),
          };

          const spriteStyle = {
            width: icon,
            height: icon,
            left: `calc(50% - ${(icon / 2).toFixed(1)}px)`,
            bottom: 12 * gridScale,
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
                    width: 92 * gridScale,
                    height: 62 * gridScale,
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
                  width: 64 * gridScale * plantScale,
                  height: 21 * gridScale * plantScale,
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
                  bottom: 6 * gridScale,
                  width: 46 * gridScale * plantScale,
                  height: 9 * gridScale * plantScale,
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.5)",
                  filter: "blur(4px)",
                }}
              />

              {/* A energia: drop-shadow atrás (profundidade) + glow suave da própria cor. */}
              {isGrowing && animate ? (
                <motion.span
                  aria-hidden="true"
                  className="absolute flex items-end justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={spriteStyle}
                >
                  {spriteImg}
                </motion.span>
              ) : (
                <span aria-hidden="true" className="absolute flex items-end justify-center" style={spriteStyle}>
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
              className="absolute border-0 bg-transparent p-0 transition-transform duration-200 hover:-translate-y-1"
            >
              {content}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
