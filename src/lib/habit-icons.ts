/** Public, typed registry for the 8-bit habit icon assets. IDs stay stable in the DB. */
export type HabitAssetCategory = "Geral";
export interface HabitIconAsset { id: string; label: string; category: HabitAssetCategory; path: string; legacyFilename: string; }

export const HABIT_ICON_ASSETS: readonly HabitIconAsset[] = [
  { id: "paper", label: "Papel", category: "Geral", path: "/habit-icons/paper.png", legacyFilename: "paper.png" },
  { id: "pencil", label: "Lápis", category: "Geral", path: "/habit-icons/pencial.png", legacyFilename: "pencial.png" },
  { id: "book", label: "Livro", category: "Geral", path: "/habit-icons/book.png", legacyFilename: "book.png" },
  { id: "calendar", label: "Calendário", category: "Geral", path: "/habit-icons/calendar.png", legacyFilename: "calendar.png" },
  { id: "dumbbell", label: "Treino", category: "Geral", path: "/habit-icons/dumbell.png", legacyFilename: "dumbell.png" },
  { id: "microphone", label: "Microfone", category: "Geral", path: "/habit-icons/microphone.png", legacyFilename: "microphone.png" },
];

export const HABIT_ICON_CATEGORIES = (["Geral"] as const).map((name) => ({
  name,
  icons: HABIT_ICON_ASSETS.filter((asset) => asset.category === name),
}));

export const DEFAULT_HABIT_ICON_ID = "paper";
const byId = new Map(HABIT_ICON_ASSETS.map((asset) => [asset.id, asset]));
const byLegacy = new Map(HABIT_ICON_ASSETS.map((asset) => [asset.legacyFilename.toLowerCase(), asset]));
// Aliases kept for backwards compatibility with previously published paths.
byLegacy.set("pencil-removebg-preview.png", byId.get("pencil")!);
byLegacy.set("pencil.png", byId.get("pencil")!);
byLegacy.set("dumbell.png", byId.get("dumbbell")!);

export function getHabitAsset(value?: string | null): HabitIconAsset {
  return byId.get(value ?? "") ?? byLegacy.get((value ?? "").split("/").pop()!.toLowerCase()) ?? byId.get(DEFAULT_HABIT_ICON_ID)!;
}

export function getIconPath(value?: string | null): string {
  return getHabitAsset(value).path;
}
