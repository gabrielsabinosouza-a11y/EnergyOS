import assert from "node:assert/strict";
import test from "node:test";
import { ENERGY_TYPES } from "./energy-assets";
import { auraStageImageCandidates } from "./aura-images";
import type { TimerGrowthStage } from "./focus-growth";

const STAGES: Array<TimerGrowthStage | "die"> = ["begin", "mid", "full", "die"];

test("every aura/stage resolves to a candidate with a fallback", () => {
  for (const auraId of ENERGY_TYPES) {
    for (const stage of STAGES) {
      const [first, fallback] = auraStageImageCandidates(auraId, stage);
      assert.equal(first, `/energies/${auraId}/${auraId}_${stage}.png`, `${auraId}_${stage}`);
      assert.ok(fallback.length > 0 && fallback !== first, `${auraId} ${stage} fallback`);
    }
  }
});

test("fallback is derived from the aura's legacy icon", () => {
  const { 0: first, 1: fallback } = auraStageImageCandidates("water", "begin");
  assert.equal(first, "/energies/water/water_begin.png");
  assert.equal(fallback, "/energies/water/water_start.png");

  const iceDie = auraStageImageCandidates("ice", "die");
  assert.equal(iceDie[0], "/energies/ice/ice_die.png");
  assert.ok(iceDie[1]); // ice only ships a legacy "gave_up" icon — must exist
});
