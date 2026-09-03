import { getEnergyReward, type EnergyType } from "./energy-assets";

export type GardenGrowthStage = "sprout" | "young" | "mature";
export type GardenStatus = "growing" | "alive" | "withered";

export interface GardenEntry {
  id: string;
  energyType: EnergyType;
  durationMinutes: number;
  reward: number;
  plantedAt: string; // ISO string
  growthStage: GardenGrowthStage;
  status: GardenStatus;
}

const KEY = "energyos_garden";

function load(): GardenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as GardenEntry[];
  } catch {
    return [];
  }
}

function save(entries: GardenEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function addGardenEntry(entry: Omit<GardenEntry, "id">): GardenEntry {
  const full: GardenEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    growthStage: entry.growthStage || "sprout",
    status: entry.status || "growing",
  };
  const entries = load();
  entries.unshift(full);
  save(entries);
  return full;
}

/**
 * Plants the energies earned by a completed focus session.
 *
 * The number of plants equals the session reward (each plant is one energy),
 * but the focused time is split evenly across them so that the SUM of
 * `durationMinutes` across all plants equals the real focused minutes. This
 * keeps the garden's "minutos de foco" totals and distribution chart accurate
 * (previously each plant stored the full duration, inflating totals by the
 * reward multiplier).
 *
 * Returns the list of planted entries (empty when no reward is earned).
 */
export function addGardenEntriesForSession(props: {
  energyType: EnergyType;
  focusedMinutes: number;
  plantedAt?: string;
  status?: GardenStatus;
}): GardenEntry[] {
  const { energyType, focusedMinutes, plantedAt = new Date().toISOString(), status = "growing" } = props;
  const reward = getEnergyReward(focusedMinutes);
  if (reward <= 0 || focusedMinutes <= 0) return [];

  const perEnergy = focusedMinutes / reward;
  const growthStage = focusedMinutes >= 60 ? "mature" : focusedMinutes >= 30 ? "young" : "sprout";
  const entries: GardenEntry[] = [];
  for (let i = 0; i < reward; i++) {
    entries.push(
      addGardenEntry({
        energyType,
        durationMinutes: perEnergy,
        reward,
        plantedAt,
        growthStage,
        status,
      }),
    );
  }
  return entries;
}

export function getGardenEntries(): GardenEntry[] {
  return load();
}
