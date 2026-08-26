export type EnergyStage = "spark" | "forming" | "full" | "extinguished";
export type EnergyType =
  | "flame" | "water" | "earth" | "wind" | "thunder" | "ice"
  | "shadow" | "light" | "crystal" | "nature" | "cosmic" | "solar";

export interface EnergyConfig {
  label: string;
  locked: boolean;
  accent: string;
  glow: string;
  assets: Record<EnergyStage, string>;
}

export const ENERGY_CONFIGS: Record<EnergyType, EnergyConfig> = {
  flame:   { label: "Flame",   locked: false, accent: "#ff6b35", glow: "rgba(255,107,53,0.22)",   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  water:   { label: "Water",   locked: false, accent: "#4fc3f7", glow: "rgba(79,195,247,0.22)",   assets: { spark: "/energies/water/water_start.png",   forming: "/energies/water/water_mid.png",   full: "/energies/water/water_full.png",   extinguished: "/energies/water/water_give_up.png"   } },
  thunder: { label: "Thunder", locked: true,  accent: "#ffd600", glow: "rgba(255,214,0,0.22)",    assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png" } },
  ice:     { label: "Ice",     locked: true,  accent: "#80deea", glow: "rgba(128,222,234,0.22)",  assets: { spark: "/energies/water/water_start.png",   forming: "/energies/water/water_mid.png",   full: "/energies/water/water_full.png",   extinguished: "/energies/water/water_give_up.png"     } },
  wind:    { label: "Wind",    locked: true,  accent: "#b0bec5", glow: "rgba(176,190,197,0.18)",  assets: { spark: "/energies/water/water_start.png",    forming: "/energies/water/water_mid.png",    full: "/energies/water/water_full.png",    extinguished: "/energies/water/water_give_up.png"    } },
  earth:   { label: "Earth",   locked: true,  accent: "#8bc34a", glow: "rgba(139,195,74,0.22)",   assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  light:   { label: "Light",   locked: true,  accent: "#fff176", glow: "rgba(255,249,196,0.28)",  assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
  shadow:  { label: "Shadow",  locked: true,  accent: "#b39ddb", glow: "rgba(179,157,219,0.22)",  assets: { spark: "/energies/water/water_start.png",  forming: "/energies/water/water_mid.png",  full: "/energies/water/water_full.png",  extinguished: "/energies/water/water_give_up.png"  } },
  cosmic:  { label: "Cosmic",  locked: true,  accent: "#ce93d8", glow: "rgba(206,147,216,0.22)",  assets: { spark: "/energies/flame/flame_start.png",  forming: "/energies/flame/flame_mid.png",  full: "/energies/flame/flame_full.png",  extinguished: "/energies/flame/flame_die.png"  } },
  crystal: { label: "Crystal", locked: true,  accent: "#80cbc4", glow: "rgba(128,203,196,0.22)",  assets: { spark: "/energies/water/water_start.png", forming: "/energies/water/water_mid.png", full: "/energies/water/water_full.png", extinguished: "/energies/water/water_give_up.png" } },
  nature:  { label: "Nature",  locked: true,  accent: "#66bb6a", glow: "rgba(102,187,106,0.22)",  assets: { spark: "/energies/flame/flame_start.png",  forming: "/energies/flame/flame_mid.png",  full: "/energies/flame/flame_full.png",  extinguished: "/energies/flame/flame_die.png"  } },
  solar:   { label: "Solar",   locked: true,  accent: "#ffb300", glow: "rgba(255,179,0,0.22)",    assets: { spark: "/energies/flame/flame_start.png",   forming: "/energies/flame/flame_mid.png",   full: "/energies/flame/flame_full.png",   extinguished: "/energies/flame/flame_die.png"   } },
};

export const ENERGY_TYPES = Object.keys(ENERGY_CONFIGS) as EnergyType[];

export function getEnergyReward(durationMinutes: number): number {
  if (durationMinutes >= 90) return 4;
  if (durationMinutes >= 60) return 2;
  if (durationMinutes >= 10) return 1;
  return 0;
}
