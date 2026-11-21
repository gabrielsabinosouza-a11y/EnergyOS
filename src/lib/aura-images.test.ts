import assert from "node:assert/strict";
import test from "node:test";
import { ENERGY_TYPES } from "./energy-assets";
import { auraStageImageCandidates } from "./aura-images";
import type { TimerGrowthStage } from "./focus-growth";

const STAGES: Array<TimerGrowthStage | "die"> = ["begin", "mid", "full", "die"];

test("every aura/stage resolves to a candidate with a fallback", () => {
  for (const auraId of ENERGY_TYPES) {
    for (const stage of STAGES) {
      const candidates = auraStageImageCandidates(auraId, stage);
      assert.equal(candidates[0], `/energies/${auraId}/${auraId}_${stage}.png`, `${auraId}_${stage}`);
      assert.ok(candidates.length >= 1 && candidates[candidates.length - 1].length > 0, `${auraId} ${stage} fallback`);
      // Candidates are unique.
      assert.equal(new Set(candidates).size, candidates.length);
    }
  }
});

test("fallback is derived from the aura's legacy icon", () => {
  const [first, fallback] = auraStageImageCandidates("water", "begin");
  assert.equal(first, "/energies/water/water_begin.png");
  assert.equal(fallback, "/energies/water/water_start.png");

  const iceDie = auraStageImageCandidates("ice", "die");
  assert.equal(iceDie[0], "/energies/ice/ice_die.png");
  assert.ok(iceDie[1]); // ice only ships a legacy "gave_up" icon — must exist
});

test("seasonal auras resolve stage images with their event-art fallback", () => {
  // Seasonal stage art lives under /assets/seasons/... (ENERGY_CONFIGS), not
  // /energies/{auraId}/ — the candidate list must fall back to it so a
  // missing {auraId}_{stage}.png never breaks the timer or the garden.
  for (const auraId of ["santa_hat", "xmas_wreath", "jack_o_lantern", "bunny"]) {
    for (const stage of STAGES) {
      const candidates = auraStageImageCandidates(auraId, stage);
      assert.equal(candidates[0], `/energies/${auraId}/${auraId}_${stage}.png`);
      assert.ok(candidates.length >= 2, `${auraId} ${stage} must have a fallback`);
      assert.ok(candidates[1].startsWith("/assets/seasons/"), `${auraId} ${stage} fallback -> ${candidates[1]}`);
    }
  }
});
