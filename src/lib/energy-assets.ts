export type EnergyStage = "spark" | "forming" | "full" | "extinguished";
export type GardenGrowthStage = "sprout" | "young" | "mature";
// "completed" supersedes "alive"; "gave_up" supersedes "withered" (dead trees).
// The legacy values are still readable from older rows.
export type GardenStatus = "growing" | "completed" | "gave_up" | "alive" | "withered";

export function isGardenCompleted(status: GardenStatus): boolean {
  return status === "completed" || status === "alive";
}

export function isGardenDead(status: GardenStatus): boolean {
  return status === "gave_up" || status === "withered";
}
export type EnergyType =
  | "flame" | "water" | "earth" | "wind" | "thunder" | "ice"
  | "shadow" | "light" | "crystal" | "cosmic"
  | "metal" | "poison"
  // Seasonal event auras (purchasable only during their season window)
  | "jack_o_lantern" | "ghost" | "witch_hat"
  | "santa_hat" | "xmas_wreath" | "xmas_tree"
  | "fireworks" | "champagne" | "midnight_clock"
  | "easter_egg" | "bunny" | "easter_basket";

export type AuraRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface AuraInfo {
  rarity: AuraRarity;
  price: number;
  label: string;
}

export const AURA_RARITY_LABELS: Record<AuraRarity, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
};

export const AURA_RARITY_COLORS: Record<AuraRarity, { border: string; bg: string; glow: string }> = {
  common:   { border: "#71d4ff",   bg: "rgba(113,212,255,0.08)",   glow: "rgba(113,212,255,0.3)" },
  uncommon: { border: "#4ade80",   bg: "rgba(74,222,128,0.08)",   glow: "rgba(74,222,128,0.3)" },
  rare:     { border: "#b69cff",   bg: "rgba(182,156,255,0.08)",   glow: "rgba(182,156,255,0.3)" },
  epic:     { border: "#ffd76b",   bg: "rgba(255,215,107,0.08)",   glow: "rgba(255,215,107,0.3)" },
  legendary:{ border: "#ff9e5e",   bg: "rgba(255,158,94,0.08)",   glow: "rgba(255,158,94,0.3)" },
};

export const AURA_DEFS: Record<EnergyType, AuraInfo> = {
  flame:   { rarity: "common",   price: 0,    label: "Flame" },
  water:   { rarity: "common",   price: 0,    label: "Water" },
  ice:     { rarity: "uncommon", price: 500,   label: "Ice" },
  wind:    { rarity: "uncommon", price: 500,   label: "Wind" },
  metal:   { rarity: "uncommon", price: 500,   label: "Metal" },
  poison:  { rarity: "uncommon", price: 500,   label: "Poison" },
  earth:   { rarity: "rare",     price: 750,   label: "Earth" },
  thunder: { rarity: "rare",     price: 750,   label: "Thunder" },
  cosmic:  { rarity: "rare",     price: 750,   label: "Cosmic" },
  // Epic tier (proposed, pending confirmation)
  light:   { rarity: "epic",     price: 1000,  label: "Light" },
  shadow:  { rarity: "epic",     price: 1000,  label: "Shadow" },
  crystal: { rarity: "epic",     price: 1000,  label: "Crystal" },
  // Seasonal auras — price/label mirror src/config/seasons.ts (single source
  // of truth for names/prices lives there; these entries exist so the
  // Record<EnergyType, …> maps stay exhaustive).
  jack_o_lantern: { rarity: "legendary", price: 2000, label: "Abóbora" },
  ghost:         { rarity: "legendary", price: 2200, label: "Fantasma" },
  witch_hat:     { rarity: "legendary", price: 2500, label: "Chapéu de Bruxa" },
  santa_hat:     { rarity: "legendary", price: 2000, label: "Gorro de Natal" },
  xmas_wreath:   { rarity: "legendary", price: 2200, label: "Coroa de Natal" },
  xmas_tree:     { rarity: "legendary", price: 2500, label: "Árvore de Natal" },
  fireworks:     { rarity: "legendary", price: 2000, label: "Fogos de Artifício" },
  champagne:     { rarity: "legendary", price: 2200, label: "Champanhe" },
  midnight_clock:{ rarity: "legendary", price: 2500, label: "Relógio da Meia-Noite" },
  easter_egg:    { rarity: "legendary", price: 2000, label: "Ovo de Páscoa" },
  bunny:         { rarity: "legendary", price: 2200, label: "Coelhinho" },
  easter_basket: { rarity: "legendary", price: 2500, label: "Cesta de Páscoa" },
};

/** Paleta de tema por energia — usada em anel, botões, glow e acentos. */
export const ENERGY_THEME_COLORS: Record<EnergyType, string> = {
  flame:   "#F97316",
  water:   "#3B82F6",
  thunder: "#A855F7",
  ice:     "#22D3EE",
  wind:    "#6EE7B7",
  metal:   "#9CA3AF",
  poison:  "#84CC16",
  earth:   "#84A98C",
  light:   "#FACC15",
  shadow:  "#6B21A8",
  cosmic:  "#818CF8",
  crystal: "#C084FC",
  // Seasonal accents
  jack_o_lantern: "#FF8A3D",
  ghost:         "#BFE3FF",
  witch_hat:     "#A855F7",
  santa_hat:     "#FF5A5A",
  xmas_wreath:   "#2FA36B",
  xmas_tree:     "#1E7A4C",
  fireworks:     "#FFD76B",
  champagne:     "#F4E3B2",
  midnight_clock:"#8FA7FF",
  easter_egg:    "#F0A6C8",
  bunny:         "#F5C6D6",
  easter_basket: "#B7E4C7",
};

function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function glowOf(type: EnergyType, alpha = 0.22): string {
  return rgba(ENERGY_THEME_COLORS[type], alpha);
}

export interface EnergyConfig extends AuraInfo {
  locked: boolean;
  accent: string;
  glow: string;
  assets: Record<EnergyStage, string>;
}

export const ENERGY_CONFIGS: Record<EnergyType, EnergyConfig> = {
  flame:   { ...AURA_DEFS.flame,   locked: false, accent: ENERGY_THEME_COLORS.flame,   glow: glowOf("flame"),   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  water:   { ...AURA_DEFS.water,   locked: false, accent: ENERGY_THEME_COLORS.water,   glow: glowOf("water"),   assets: { spark: "/energies/water/water_start.png",   forming: "/energies/water/water_mid.png",   full: "/energies/water/water_full.png",   extinguished: "/energies/water/water_give_up.png"   } },
  thunder: { ...AURA_DEFS.thunder, locked: true,  accent: ENERGY_THEME_COLORS.thunder, glow: glowOf("thunder"), assets: { spark: "/energies/thunder/thunder_begin.png", forming: "/energies/thunder/thunder_mid.png", full: "/energies/thunder/thunder_full.png", extinguished: "/energies/thunder/thunder_die.png" } },
  ice:     { ...AURA_DEFS.ice,     locked: true,  accent: ENERGY_THEME_COLORS.ice,     glow: glowOf("ice"),     assets: { spark: "/energies/ice/ice_begin.png",    forming: "/energies/ice/ice_mid.png",    full: "/energies/ice/ice_full.png",    extinguished: "/energies/ice/ice_gave_up.png"    } },
  wind:    { ...AURA_DEFS.wind,    locked: true,  accent: ENERGY_THEME_COLORS.wind,    glow: glowOf("wind"),    assets: { spark: "/energies/wind/wind_begin.png",    forming: "/energies/wind/wind_mid.png",     full: "/energies/wind/wind_full.png",   extinguished: "/energies/wind/wind_die.png"    } },
  metal:   { ...AURA_DEFS.metal,   locked: true,  accent: ENERGY_THEME_COLORS.metal,   glow: glowOf("metal"),   assets: { spark: "/energies/metal/metal_begin.png",   forming: "/energies/metal/metal_mid.png",    full: "/energies/metal/metal_full.png",   extinguished: "/energies/metal/metal_die.png"    } },
  poison:  { ...AURA_DEFS.poison,  locked: true,  accent: ENERGY_THEME_COLORS.poison,  glow: glowOf("poison"),  assets: { spark: "/energies/poison/poison_begin.png",  forming: "/energies/poison/poison_mid.png",   full: "/energies/poison/poison_full.png",  extinguished: "/energies/poison/poison_die.png"   } },
  earth:   { ...AURA_DEFS.earth,   locked: true,  accent: ENERGY_THEME_COLORS.earth,   glow: glowOf("earth"),   assets: { spark: "/energies/earth/earth_begin.png",   forming: "/energies/earth/earth_mid.png",   full: "/energies/earth/earth_full.png",   extinguished: "/energies/earth/earth_die.png"   } },
  light:   { ...AURA_DEFS.light,   locked: true,  accent: ENERGY_THEME_COLORS.light,   glow: glowOf("light"),   assets: { spark: "/energies/light/light_begin.png",   forming: "/energies/light/light_mid.png",   full: "/energies/light/light_full.png",   extinguished: "/energies/light/light_die.png"   } },
  shadow:  { ...AURA_DEFS.shadow,  locked: true,  accent: ENERGY_THEME_COLORS.shadow,  glow: glowOf("shadow"),  assets: { spark: "/energies/shadow/shadow_begin.png", forming: "/energies/shadow/shadow_mid.png", full: "/energies/shadow/shadow_full.png", extinguished: "/energies/shadow/shadow_die.png" } },
  cosmic:  { ...AURA_DEFS.cosmic,  locked: true,  accent: ENERGY_THEME_COLORS.cosmic,  glow: glowOf("cosmic"),  assets: { spark: "/energies/cosmic/cosmic_begin.png", forming: "/energies/cosmic/cosmic_mid.png", full: "/energies/cosmic/cosmic_full.png", extinguished: "/energies/cosmic/cosmic_die.png" } },
  crystal: { ...AURA_DEFS.crystal, locked: true,  accent: ENERGY_THEME_COLORS.crystal, glow: glowOf("crystal"), assets: { spark: "/energies/crystal/crystal_begin.png", forming: "/energies/crystal/crystal_mid.png", full: "/energies/crystal/crystal_full.png", extinguished: "/energies/crystal/crystal_die.png" } },
  // Seasonal auras — single artwork per item used for every energy stage.
  jack_o_lantern: { ...AURA_DEFS.jack_o_lantern, locked: true, accent: ENERGY_THEME_COLORS.jack_o_lantern, glow: glowOf("jack_o_lantern"), assets: { spark: "/assets/seasons/halloween/auras/jack_o_lantern.png", forming: "/assets/seasons/halloween/auras/jack_o_lantern.png", full: "/assets/seasons/halloween/auras/jack_o_lantern.png", extinguished: "/assets/seasons/halloween/auras/jack_o_lantern.png" } },
  ghost:         { ...AURA_DEFS.ghost,         locked: true, accent: ENERGY_THEME_COLORS.ghost,         glow: glowOf("ghost"),         assets: { spark: "/assets/seasons/halloween/auras/ghost.png",         forming: "/assets/seasons/halloween/auras/ghost.png",         full: "/assets/seasons/halloween/auras/ghost.png",         extinguished: "/assets/seasons/halloween/auras/ghost.png"         } },
  witch_hat:     { ...AURA_DEFS.witch_hat,     locked: true, accent: ENERGY_THEME_COLORS.witch_hat,     glow: glowOf("witch_hat"),     assets: { spark: "/assets/seasons/halloween/auras/witch_hat.png",     forming: "/assets/seasons/halloween/auras/witch_hat.png",     full: "/assets/seasons/halloween/auras/witch_hat.png",     extinguished: "/assets/seasons/halloween/auras/witch_hat.png"     } },
  santa_hat:     { ...AURA_DEFS.santa_hat,     locked: true, accent: ENERGY_THEME_COLORS.santa_hat,     glow: glowOf("santa_hat"),     assets: { spark: "/assets/seasons/christmas/auras/santa_hat.png",     forming: "/assets/seasons/christmas/auras/santa_hat.png",     full: "/assets/seasons/christmas/auras/santa_hat.png",     extinguished: "/assets/seasons/christmas/auras/santa_hat.png"     } },
  xmas_wreath:   { ...AURA_DEFS.xmas_wreath,   locked: true, accent: ENERGY_THEME_COLORS.xmas_wreath,   glow: glowOf("xmas_wreath"),   assets: { spark: "/assets/seasons/christmas/auras/xmas_wreath.png",   forming: "/assets/seasons/christmas/auras/xmas_wreath.png",   full: "/assets/seasons/christmas/auras/xmas_wreath.png",   extinguished: "/assets/seasons/christmas/auras/xmas_wreath.png"   } },
  xmas_tree:     { ...AURA_DEFS.xmas_tree,     locked: true, accent: ENERGY_THEME_COLORS.xmas_tree,     glow: glowOf("xmas_tree"),     assets: { spark: "/assets/seasons/christmas/auras/xmas_tree.png",     forming: "/assets/seasons/christmas/auras/xmas_tree.png",     full: "/assets/seasons/christmas/auras/xmas_tree.png",     extinguished: "/assets/seasons/christmas/auras/xmas_tree.png"     } },
  fireworks:     { ...AURA_DEFS.fireworks,     locked: true, accent: ENERGY_THEME_COLORS.fireworks,     glow: glowOf("fireworks"),     assets: { spark: "/assets/seasons/newyear/auras/fireworks.png",     forming: "/assets/seasons/newyear/auras/fireworks.png",     full: "/assets/seasons/newyear/auras/fireworks.png",     extinguished: "/assets/seasons/newyear/auras/fireworks.png"     } },
  champagne:     { ...AURA_DEFS.champagne,     locked: true, accent: ENERGY_THEME_COLORS.champagne,     glow: glowOf("champagne"),     assets: { spark: "/assets/seasons/newyear/auras/champagne.png",     forming: "/assets/seasons/newyear/auras/champagne.png",     full: "/assets/seasons/newyear/auras/champagne.png",     extinguished: "/assets/seasons/newyear/auras/champagne.png"     } },
  midnight_clock:{ ...AURA_DEFS.midnight_clock, locked: true, accent: ENERGY_THEME_COLORS.midnight_clock, glow: glowOf("midnight_clock"), assets: { spark: "/assets/seasons/newyear/auras/midnight_clock.png", forming: "/assets/seasons/newyear/auras/midnight_clock.png", full: "/assets/seasons/newyear/auras/midnight_clock.png", extinguished: "/assets/seasons/newyear/auras/midnight_clock.png" } },
  easter_egg:    { ...AURA_DEFS.easter_egg,    locked: true, accent: ENERGY_THEME_COLORS.easter_egg,    glow: glowOf("easter_egg"),    assets: { spark: "/assets/seasons/easter/auras/easter_egg.png",    forming: "/assets/seasons/easter/auras/easter_egg.png",    full: "/assets/seasons/easter/auras/easter_egg.png",    extinguished: "/assets/seasons/easter/auras/easter_egg.png"    } },
  bunny:         { ...AURA_DEFS.bunny,         locked: true, accent: ENERGY_THEME_COLORS.bunny,         glow: glowOf("bunny"),         assets: { spark: "/assets/seasons/easter/auras/bunny.png",         forming: "/assets/seasons/easter/auras/bunny.png",         full: "/assets/seasons/easter/auras/bunny.png",         extinguished: "/assets/seasons/easter/auras/bunny.png"         } },
  easter_basket: { ...AURA_DEFS.easter_basket, locked: true, accent: ENERGY_THEME_COLORS.easter_basket, glow: glowOf("easter_basket"), assets: { spark: "/assets/seasons/easter/auras/easter_basket.png", forming: "/assets/seasons/easter/auras/easter_basket.png", full: "/assets/seasons/easter/auras/easter_basket.png", extinguished: "/assets/seasons/easter/auras/easter_basket.png" } },
};

export const ENERGY_TYPES = Object.keys(ENERGY_CONFIGS) as EnergyType[];

export function getEnergyReward(durationMinutes: number): number {
  if (durationMinutes >= 90) return 4;
  if (durationMinutes >= 60) return 2;
  if (durationMinutes >= 10) return 1;
  return 0;
}

/** Picks a sensible default energy for a focus session: flame when owned, else the first owned aura. */
export function resolveDefaultEnergy(ownedAuras: string[]): EnergyType {
  if (ownedAuras.includes("flame")) return "flame";
  if (ownedAuras.length > 0) return ownedAuras[0] as EnergyType;
  return "flame";
}

/** Streak icon reflecting a user's streak state: alive when > 0, otherwise lost/protected. */
export function streakIconSource(streak: number): string {
  return streak > 0 ? "/streak/streak_alive.png" : "/streak/streak_lost.png";
}

/** Map garden growth stage to energy visual stage.
 *
 * A plant whose session finished (status "alive") reached its final form and
 * must render its own full-stage illustration ("Completo"). Only sessions still
 * in progress ("growing") show the intermediate sprout/young visuals. */
export function mapGrowthStageToEnergyStage(growthStage: GardenGrowthStage, status: GardenStatus): EnergyStage {
  if (isGardenDead(status)) return "extinguished";
  if (isGardenCompleted(status)) return "full";
  if (growthStage === "sprout") return "spark";
  if (growthStage === "young") return "forming";
  return "full";
}