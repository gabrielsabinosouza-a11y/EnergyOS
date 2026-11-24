import { CloudRain, Flame, type LucideIcon } from "lucide-react";

/**
 * Ambient sound catalog — adding a new sound = ONE entry here.
 * Files live in public/sounds/ as `<fileBase>.ogg` (preferred) with
 * `<fileBase>.mp3` fallback. See public/sounds/README.md for sourcing.
 */
export interface AmbientSoundDef {
  id: string;
  label: string;
  icon: LucideIcon;
  fileBase: string;
  defaultVolume: number; // 0..1
}

export const AMBIENT_SOUNDS: readonly AmbientSoundDef[] = [
  {
    id: "rain",
    label: "Som de chuva",
    icon: CloudRain,
    fileBase: "rain",
    defaultVolume: 0.7,
  },
  {
    id: "fireplace",
    label: "Lareira",
    icon: Flame,
    fileBase: "fireplace",
    defaultVolume: 0.7,
  },
] as const;

export const AMBIENT_SOUND_BY_ID = new Map(AMBIENT_SOUNDS.map((s) => [s.id, s]));

export function isAmbientSoundId(id: string): boolean {
  return AMBIENT_SOUND_BY_ID.has(id);
}
