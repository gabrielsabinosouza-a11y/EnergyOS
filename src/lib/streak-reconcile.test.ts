import test from "node:test";
import assert from "node:assert/strict";
import { needsStreakReconciliation, reconcileStreak } from "./streak-reconcile";
import { dayInTz } from "./db/dates";

function addDays(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test("does not recompute an inactive profile on every streak-calendar request", () => {
  assert.equal(needsStreakReconciliation({
    currentStreak: 0,
    latestFocusDay: null,
    latestProtectedDay: null,
    latestLogDay: null,
    today: "2026-10-20",
  }), false);
});

test("reconciles an unlogged focus day", () => {
  assert.equal(needsStreakReconciliation({
    currentStreak: 0,
    latestFocusDay: "2026-10-20",
    latestProtectedDay: null,
    latestLogDay: "2026-10-19",
    today: "2026-10-20",
  }), true);
});

test("reconciles an active streak through yesterday, then stops once logged", () => {
  const pending = {
    currentStreak: 8,
    latestFocusDay: "2026-10-18",
    latestProtectedDay: null,
    latestLogDay: "2026-10-18",
    today: "2026-10-20",
  };
  assert.equal(needsStreakReconciliation(pending), true);
  assert.equal(needsStreakReconciliation({
    ...pending,
    latestLogDay: "2026-10-19",
  }), false);
});

test("does not recompute after today's focus event is already logged", () => {
  assert.equal(needsStreakReconciliation({
    currentStreak: 8,
    latestFocusDay: "2026-10-20",
    latestProtectedDay: null,
    latestLogDay: "2026-10-20",
    today: "2026-10-20",
  }), false);
});

test("one missed day consumes one shield and preserves the streak", () => {
  const focusDays = addDays("2026-10-01", 15);
  const result = reconcileStreak({
    focusDays,
    protectedDays: [],
    shields: 3,
    today: "2026-10-17",
  });

  assert.deepEqual(result.newProtectedDays, ["2026-10-16"]);
  assert.equal(result.shields, 2);
  assert.equal(result.currentStreak, 15);
});

test("three consecutive missed days consume all three shields and keep the streak alive", () => {
  const focusDays = addDays("2026-10-01", 15);
  const result = reconcileStreak({
    focusDays,
    protectedDays: [],
    shields: 3,
    today: "2026-10-19",
  });

  assert.deepEqual(result.newProtectedDays, ["2026-10-16", "2026-10-17", "2026-10-18"]);
  assert.equal(result.shields, 0);
  assert.equal(result.currentStreak, 15);
});

test("a fourth missed day is lost after spending the three available shields", () => {
  const focusDays = addDays("2026-10-01", 15);
  const result = reconcileStreak({
    focusDays,
    protectedDays: [],
    shields: 3,
    today: "2026-10-20",
  });

  assert.deepEqual(result.newProtectedDays, ["2026-10-16", "2026-10-17", "2026-10-18"]);
  assert.deepEqual(result.lostDays, ["2026-10-19"]);
  assert.equal(result.shields, 0);
  assert.equal(result.currentStreak, 0);
  assert.equal(result.bestStreak, 15);
  assert.equal(result.status, "broken");
});

test("protected days preserve the streak but do not increase its count or spend unused shields", () => {
  const focusDays = addDays("2026-10-01", 13);
  const protectedDay = "2026-10-14";
  const result = reconcileStreak({
    focusDays,
    protectedDays: [protectedDay],
    shields: 3,
    today: protectedDay,
  });

  assert.equal(result.currentStreak, 13);
  assert.equal(result.bestStreak, 13);
  assert.equal(result.shields, 3);
});

test("reaching 14 focus days leaves all three shields untouched", () => {
  const focusDays = addDays("2026-10-01", 14);
  const result = reconcileStreak({
    focusDays,
    protectedDays: [],
    shields: 3,
    today: "2026-10-14",
  });

  assert.equal(result.currentStreak, 14);
  assert.equal(result.shields, 3);
});

test("America/Sao_Paulo day boundaries are independent of the browser's UTC date", () => {
  assert.equal(dayInTz(new Date("2026-10-04T02:59:59.000Z")), "2026-10-03");
  assert.equal(dayInTz(new Date("2026-10-04T03:00:00.000Z")), "2026-10-04");
});
