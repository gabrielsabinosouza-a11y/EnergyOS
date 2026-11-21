/**
 * Stage-image candidates for the spirit tree's auras.
 *
 * Naming convention: {auraId}_{stage}.png (e.g. earth_begin.png) placed next
 * to the aura's existing assets (public/energies/{auraId}/). Every stage
 * resolves to at least one path — the aura's existing icon from
 * ENERGY_CONFIGS as fallback, so a missing stage image never breaks the app.
 */

import { ENERGY_CONFIGS, type EnergyConfig, type EnergyStage, type EnergyType } from "@/lib/energy-assets";
import type { TimerGrowthStage } from "@/lib/focus-growth";

export type AuraStageName = TimerGrowthStage | "die";

/** Map the legacy EnergyStage names (spark/forming/full/extinguished) onto
 *  the {auraId}_{stage}.png naming used by AuraStageImage. */
export function energyStageToAuraStage(stage: EnergyStage): AuraStageName {
  switch (stage) {
    case "spark": return "begin";
    case "forming": return "mid";
    case "full": return "full";
    case "extinguished": return "die";
  }
}

interface StageAssetNames {
  /** New-style file name, "{auraId}_{stage}.png". */
  newName: string;
  /** Legacy ENERGY_CONFIGS asset key (spark/forming/full/extinguished). */
  legacyKey: keyof EnergyConfig["assets"];
}

const STAGE_ASSET_NAMES: Record<AuraStageName, StageAssetNames> = {
  begin: { newName: "begin", legacyKey: "spark" },
  mid: { newName: "mid", legacyKey: "forming" },
  full: { newName: "full", legacyKey: "full" },
  die: { newName: "die", legacyKey: "extinguished" },
};

/** Ordered candidates (new naming first, legacy icon as fallback). */
export function auraStageImageCandidates(
  auraId: string,
  stage: AuraStageName,
  cfg?: EnergyConfig,
): string[] {
  const c = cfg ?? (ENERGY_CONFIGS[auraId as EnergyType] ?? ENERGY_CONFIGS.flame);
  const { newName, legacyKey } = STAGE_ASSET_NAMES[stage];
  const first = `/energies/${auraId}/${auraId}_${newName}.png`;
  // Stage art may also live next to the aura's existing asset (e.g. seasonal
  // auras keep their icons under /assets/seasons/{season}/auras/).
  const fullAsset = c.assets.full;
  const variant = fullAsset
    ? `${fullAsset.slice(0, fullAsset.lastIndexOf("/") + 1)}${auraId}_${newName}.png`
    : null;
  const fallback = c.assets[legacyKey] || fullAsset;
  const out = [first];
  if (variant && variant !== first) out.push(variant);
  if (fallback && !out.includes(fallback)) out.push(fallback);
  return out;
}

/**
 * Best-effort preload of all four stage images of an aura (begin/mid/full/die
 * and their legacy fallbacks) so the stage swap flickers nothing.
 */
export function preloadAuraStageImages(auraId: string, cfg?: EnergyConfig): void {
  if (typeof window === "undefined" || !auraId) return;
  const seen = new Set<string>();
  for (const stage of ["begin", "mid", "full", "die"] as const) {
    for (const url of auraStageImageCandidates(auraId, stage, cfg)) {
      if (seen.has(url)) continue;
      seen.add(url);
      const img = new Image();
      img.src = url;
    }
  }
}
