import assert from "node:assert/strict";
import test from "node:test";
import { STAGE_MID_THRESHOLD, getGrowthStage } from "./focus-growth";

test("begin covers 0% up to (but not including) 33%", () => {
  assert.equal(STAGE_MID_THRESHOLD, 0.33);
  assert.equal(getGrowthStage(0, 1000), "begin");
  assert.equal(getGrowthStage(320, 1000), "begin");
  assert.equal(getGrowthStage(330 - 1, 1000), "begin"); // just under 33%
});

test("mid starts at 33% and runs until the session completes", () => {
  assert.equal(getGrowthStage(330, 1000), "mid");
  assert.equal(getGrowthStage(600, 1000), "mid");
  assert.equal(getGrowthStage(999, 1000), "mid"); // 99.9% is mid
  assert.equal(getGrowthStage(999.9, 1000), "mid");
});

test("full is returned only when the session is completed (100%)", () => {
  assert.equal(getGrowthStage(1000, 1000), "full");
  assert.equal(getGrowthStage(1500, 1000), "full");
});

test("thresholds are relative, so different session lengths work the same", () => {
  const total = 25 * 60 * 1000; // a 25-minute session
  assert.equal(getGrowthStage(0, total), "begin");
  assert.equal(getGrowthStage(Math.ceil(total * 0.329), total), "begin"); // 32.9%
  assert.equal(getGrowthStage(Math.ceil(total * 0.33), total), "mid"); // 33%
  assert.equal(getGrowthStage(Math.ceil(total * 0.999), total), "mid"); // 99.9%
  assert.equal(getGrowthStage(total, total), "full");
});

test("reload: the stage restores from the server-stamped start", () => {
  // Simulates returning to the page mid-session: the wall clock moved past
  // the session's startedAt (from the DB), so elapsed is recomputed from it.
  const total = 25 * 60 * 1000;
  const startedAt = Date.now() - Math.ceil(total * 0.4); // 40% elapsed before reload
  const elapsedAfterReload = Date.now() - startedAt;
  assert.equal(getGrowthStage(elapsedAfterReload, total), "mid");
});
