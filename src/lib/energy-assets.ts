export type EnergyStage = "spark" | "forming" | "full" | "extinguished";
export type EnergyType =
  | "flame" | "water" | "earth" | "wind" | "thunder" | "ice"
  | "shadow" | "light" | "crystal" | "nature" | "cosmic" | "solar";

/** Paleta de tema por energia — usada em anel, botões, glow e acentos. */
export const ENERGY_THEME_COLORS: Record<EnergyType, string> = {
  flame:   "#F97316",
  water:   "#3B82F6",
  thunder: "#A855F7",
  ice:     "#22D3EE",
  wind:    "#6EE7B7",
  earth:   "#84A98C",
  light:   "#FACC15",
  shadow:  "#6B21A8",
  cosmic:  "#818CF8",
  crystal: "#C084FC",
  nature:  "#4ADE80",
  solar:   "#F87171",
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

export interface EnergyConfig {
  label: string;
  locked: boolean;
  accent: string;
  glow: string;
  assets: Record<EnergyStage, string>;
}

export const ENERGY_CONFIGS: Record<EnergyType, EnergyConfig> = {
  flame:   { label: "Flame",   locked: false, accent: ENERGY_THEME_COLORS.flame,   glow: glowOf("flame"),   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  water:   { label: "Water",   locked: false, accent: ENERGY_THEME_COLORS.water,   glow: glowOf("water"),   assets: { spark: "/energies/water/water_start.png",   forming: "/energies/water/water_mid.png",   full: "/energies/water/water_full.png",   extinguished: "/energies/water/water_give_up.png"   } },
  thunder: { label: "Thunder", locked: true,  accent: ENERGY_THEME_COLORS.thunder, glow: glowOf("thunder"), assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png" } },
  ice:     { label: "Ice",     locked: true,  accent: ENERGY_THEME_COLORS.ice,     glow: glowOf("ice"),     assets: { spark: "/energies/water/water_start.png",   forming: "/energies/water/water_mid.png",   full: "/energies/water/water_full.png",   extinguished: "/energies/water/water_give_up.png"     } },
  wind:    { label: "Wind",    locked: true,  accent: ENERGY_THEME_COLORS.wind,    glow: glowOf("wind"),    assets: { spark: "/energies/water/water_start.png",    forming: "/energies/water/water_mid.png",    full: "/energies/water/water_full.png",    extinguished: "/energies/water/water_give_up.png"    } },
  earth:   { label: "Earth",   locked: true,  accent: ENERGY_THEME_COLORS.earth,   glow: glowOf("earth"),   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  light:   { label: "Light",   locked: true,  accent: ENERGY_THEME_COLORS.light,   glow: glowOf("light"),   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  shadow:  { label: "Shadow",  locked: true,  accent: ENERGY_THEME_COLORS.shadow,  glow: glowOf("shadow"),  assets: { spark: "/energies/water/water_start.png",  forming: "/energies/water/water_mid.png",  full: "/energies/water/water_full.png",  extinguished: "/energies/water/water_give_up.png"  } },
  cosmic:  { label: "Cosmic",  locked: true,  accent: ENERGY_THEME_COLORS.cosmic,  glow: glowOf("cosmic"),  assets: { spark: "/energies/flame/flame_start.png",  forming: "/energies/flame/flame_mid.png",  full: "/energies/flame/flame_full.png",  extinguished: "/energies/flame/flame_die.png"  } },
  crystal: { label: "Crystal", locked: true,  accent: ENERGY_THEME_COLORS.crystal, glow: glowOf("crystal"), assets: { spark: "/energies/water/water_start.png", forming: "/energies/water/water_mid.png", full: "/energies/water/water_full.png", extinguished: "/energies/water/water_give_up.png" } },
  nature:  { label: "Nature",  locked: true,  accent: ENERGY_THEME_COLORS.nature,  glow: glowOf("nature"),  assets: { spark: "/energies/flame/flame_start.png",  forming: "/energies/flame/flame_mid.png",  full: "/energies/flame/flame_full.png",  extinguished: "/energies/flame/flame_die.png"  } },
  solar:   { label: "Solar",   locked: true,  accent: ENERGY_THEME_COLORS.solar,   glow: glowOf("solar"),   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
};

export const ENERGY_TYPES = Object.keys(ENERGY_CONFIGS) as EnergyType[];

export function getEnergyReward(durationMinutes: number): number {
  if (durationMinutes >= 90) return 4;
  if (durationMinutes >= 60) return 2;
  if (durationMinutes >= 10) return 1;
  return 0;
}
