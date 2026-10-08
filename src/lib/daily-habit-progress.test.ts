import assert from "node:assert/strict";
import test from "node:test";
import { adjustDailyProgress, clampDailyProgress, isDailyTargetReached, normalizeDailyTarget } from "./daily-habit-progress";

test("legacy and invalid targets default to one", () => {
  assert.equal(normalizeDailyTarget(undefined), 1);
  assert.equal(normalizeDailyTarget(0), 1);
  assert.equal(normalizeDailyTarget(2), 2);
});

test("progress is bounded between zero and its daily target", () => {
  assert.equal(clampDailyProgress(-1, 2), 0);
  assert.equal(clampDailyProgress(1, 2), 1);
  assert.equal(clampDailyProgress(8, 6), 6);
  assert.equal(adjustDailyProgress(0, 2, -1), 0);
  assert.equal(adjustDailyProgress(1, 2, 1), 2);
});

test("a multi-count habit completes only when its target is reached", () => {
  assert.equal(isDailyTargetReached(0, 2), false);
  assert.equal(isDailyTargetReached(1, 2), false);
  assert.equal(isDailyTargetReached(2, 2), true);
  assert.equal(isDailyTargetReached(1, 2), false); // 1/2
  assert.equal(isDailyTargetReached(2, 2), true); // 2/2
  assert.equal(isDailyTargetReached(5, 6), false); // 5/6
  assert.equal(isDailyTargetReached(6, 6), true); // 6/6
  assert.equal(isDailyTargetReached(1, 1), true);
});

test("decrementing multi-count progress never drops below zero", () => {
  assert.equal(adjustDailyProgress(2, 2, -1), 1);
  assert.equal(adjustDailyProgress(1, 6, -1), 0);
  assert.equal(adjustDailyProgress(0, 6, -1), 0);
});
