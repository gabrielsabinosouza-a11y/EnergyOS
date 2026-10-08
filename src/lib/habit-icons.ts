/** Public, typed registry for the 8-bit habit icon assets. IDs stay stable in the DB. */
export type HabitAssetCategory = "Geral";
export interface HabitIconAsset { id: string; label: string; category: HabitAssetCategory; path: string; legacyFilename: string; }

export const HABIT_ICON_ASSETS: readonly HabitIconAsset[] = [
  { id: "paper", label: "Papel", category: "Geral", path: "/habit-icons/paper.png", legacyFilename: "paper.png" },
  { id: "pencil", label: "Lápis", category: "Geral", path: "/icons_8bits/pencil-removebg-preview.png", legacyFilename: "pencil-removebg-preview.png" },
  { id: "book", label: "Livro", category: "Geral", path: "/habit-icons/book.png", legacyFilename: "book.png" },
];

export const HABIT_ICON_CATEGORIES = (["Geral"] as const).map((name) => ({
  name,
  icons: HABIT_ICON_ASSETS.filter((asset) => asset.category === name),
}));

export const DEFAULT_HABIT_ICON_ID = "paper";
const byId = new Map(HABIT_ICON_ASSETS.map((asset) => [asset.id, asset]));
const byLegacy = new Map(HABIT_ICON_ASSETS.map((asset) => [asset.legacyFilename.toLowerCase(), asset]));

export function getHabitAsset(value?: string | null): HabitIconAsset {
  return byId.get(value ?? "") ?? byLegacy.get((value ?? "").split("/").pop()!.toLowerCase()) ?? byId.get(DEFAULT_HABIT_ICON_ID)!;
}

export function getIconPath(value?: string | null): string {
  return getHabitAsset(value).path;
}
