import assert from "node:assert/strict";
import test from "node:test";
import {
  AWAY_LIMIT_SECONDS,
  GRACE_PERIOD_SECONDS,
  canCancelFocusSession,
  canPauseFocusSession,
  focusPhaseAt,
  focusSessionEffects,
  focusedSecondsAt,
  shouldGiveUpAfterAway,
  transitionFocusSession,
} from "./focus-session-state";

const start = 1_000_000;

test("the grace window permits cancel at 0, 14 and 15 seconds only", () => {
  for (const seconds of [0, 14, GRACE_PERIOD_SECONDS]) {
    assert.equal(canCancelFocusSession(start, start + seconds * 1000), true);
  }
  assert.equal(canCancelFocusSession(start, start + 17_001), false);
  assert.equal(focusPhaseAt(start, start + 14_999), "grace_period");
  assert.equal(focusPhaseAt(start, start + 15_000), "focusing");
  assert.equal(transitionFocusSession("focusing", "cancel", 16), null);
});

test("pause is disabled during grace and pause/resume apply only while focusing", () => {
  assert.equal(canPauseFocusSession("grace_period"), false);
  assert.equal(transitionFocusSession("grace_period", "pause"), null);
  assert.equal(transitionFocusSession("focusing", "pause"), "paused");
  assert.equal(transitionFocusSession("paused", "resume"), "focusing");
});

test("give-up, completion and duplicate terminal requests are deterministic", () => {
  assert.equal(transitionFocusSession("focusing", "give_up"), "gave_up");
  assert.equal(transitionFocusSession("paused", "give_up"), "gave_up");
  assert.equal(transitionFocusSession("focusing", "complete", 59, 60), null);
  assert.equal(transitionFocusSession("focusing", "complete", 60, 60), "completed");
  assert.equal(transitionFocusSession("completed", "complete", 60, 60), null);
});

test("focused time excludes pauses and away time expires at the named limit", () => {
  assert.equal(focusedSecondsAt(start, start + 30_000, 10), 20);
  assert.equal(focusedSecondsAt(start, start + 30_000, 0, start + 20_000), 20);
  assert.equal(shouldGiveUpAfterAway(AWAY_LIMIT_SECONDS - 1), false);
  assert.equal(shouldGiveUpAfterAway(AWAY_LIMIT_SECONDS), true);
});

test("a grace cancel has no persistence, focus stats, rewards or progress effects", () => {
  assert.deepEqual(focusSessionEffects("cancelled"), {
    persistSession: false,
    countFocusedTime: false,
    awardRewards: false,
    advanceProgress: false,
  });
  assert.deepEqual(focusSessionEffects("gave_up"), {
    persistSession: true,
    countFocusedTime: true,
    awardRewards: false,
    advanceProgress: false,
  });
  assert.equal(transitionFocusSession("grace_period", "cancel", 15), "idle");
});
