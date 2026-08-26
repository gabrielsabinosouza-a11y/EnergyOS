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
  flame:   { label: "Flame",   locked: false, accent: "#ff6b35", glow: "rgba(255,107,53,0.22)",   assets: { spark: "/energies/flame_spark.png",   forming: "/energies/flame_forming.png",   full: "/energies/flame_full.png",   extinguished: "/energies/flame_extinguished.png"   } },
  water:   { label: "Water",   locked: false, accent: "#4fc3f7", glow: "rgba(79,195,247,0.22)",   assets: { spark: "/energies/water_spark.png",   forming: "/energies/water_forming.png",   full: "/energies/water_full.png",   extinguished: "/energies/water_extinguished.png"   } },
  thunder: { label: "Thunder", locked: false, accent: "#ffd600", glow: "rgba(255,214,0,0.22)",    assets: { spark: "/energies/thunder_spark.png", forming: "/energies/thunder_forming.png", full: "/energies/thunder_full.png", extinguished: "/energies/thunder_extinguished.png" } },
  ice:     { label: "Ice",     locked: false, accent: "#80deea", glow: "rgba(128,222,234,0.22)",  assets: { spark: "/energies/ice_spark.png",     forming: "/energies/ice_forming.png",     full: "/energies/ice_full.png",     extinguished: "/energies/ice_extinguished.png"     } },
  wind:    { label: "Wind",    locked: false, accent: "#b0bec5", glow: "rgba(176,190,197,0.18)",  assets: { spark: "/energies/wind_spark.png",    forming: "/energies/wind_forming.png",    full: "/energies/wind_full.png",    extinguished: "/energies/wind_extinguished.png"    } },
  earth:   { label: "Earth",   locked: false, accent: "#8bc34a", glow: "rgba(139,195,74,0.22)",   assets: { spark: "/energies/earth_spark.png",   forming: "/energies/earth_forming.png",   full: "/energies/earth_full.png",   extinguished: "/energies/earth_extinguished.png"   } },
  light:   { label: "Light",   locked: false, accent: "#fff176", glow: "rgba(255,249,196,0.28)",  assets: { spark: "/energies/light_spark.png",   forming: "/energies/light_forming.png",   full: "/energies/light_full.png",   extinguished: "/energies/light_extinguished.png"   } },
  shadow:  { label: "Shadow",  locked: false, accent: "#b39ddb", glow: "rgba(179,157,219,0.22)",  assets: { spark: "/energies/shadow_spark.png",  forming: "/energies/shadow_forming.png",  full: "/energies/shadow_full.png",  extinguished: "/energies/shadow_extinguished.png"  } },
  cosmic:  { label: "Cosmic",  locked: true,  accent: "#ce93d8", glow: "rgba(206,147,216,0.22)",  assets: { spark: "/energies/cosmic_spark.png",  forming: "/energies/cosmic_forming.png",  full: "/energies/cosmic_full.png",  extinguished: "/energies/cosmic_extinguished.png"  } },
  crystal: { label: "Crystal", locked: true,  accent: "#80cbc4", glow: "rgba(128,203,196,0.22)",  assets: { spark: "/energies/crystal_spark.png", forming: "/energies/crystal_forming.png", full: "/energies/crystal_full.png", extinguished: "/energies/crystal_extinguished.png" } },
  nature:  { label: "Nature",  locked: true,  accent: "#66bb6a", glow: "rgba(102,187,106,0.22)",  assets: { spark: "/energies/nature_spark.png",  forming: "/energies/nature_forming.png",  full: "/energies/nature_full.png",  extinguished: "/energies/nature_extinguished.png"  } },
  solar:   { label: "Solar",   locked: true,  accent: "#ffb300", glow: "rgba(255,179,0,0.22)",    assets: { spark: "/energies/solar_spark.png",   forming: "/energies/solar_forming.png",   full: "/energies/solar_full.png",   extinguished: "/energies/solar_extinguished.png"   } },
};

export const ENERGY_TYPES = Object.keys(ENERGY_CONFIGS) as EnergyType[];

export function getEnergyReward(durationMinutes: number): number {
  if (durationMinutes >= 90) return 4;
  if (durationMinutes >= 60) return 2;
  if (durationMinutes >= 10) return 1;
  return 0;
}
