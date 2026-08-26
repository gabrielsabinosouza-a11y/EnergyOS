import type { EnergyType } from "./energy-assets";

export interface GardenEntry {
  id: string;
  energyType: EnergyType;
  durationMinutes: number;
  reward: number;
  plantedAt: string; // ISO string
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
  const full: GardenEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  const entries = load();
  entries.unshift(full);
  save(entries);
  return full;
}

export function getGardenEntries(): GardenEntry[] {
  return load();
}
