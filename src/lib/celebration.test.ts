import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CELEBRATION,
  celebrationCoinCount,
  claimPendingCelebration,
  clearPendingCelebration,
  markCelebrationPending,
} from "./celebration";

/** In-memory StorageLike for tests. */
function fakeStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

test("celebrationCoinCount: zero coins → no flight", () => {
  assert.equal(celebrationCoinCount(0), 0);
  assert.equal(celebrationCoinCount(-5), 0);
});

test("celebrationCoinCount: scales with reward, bounded by min/max", () => {
  assert.equal(celebrationCoinCount(10), CELEBRATION.minFlyingCoins);
  assert.equal(celebrationCoinCount(75), 8);
  assert.equal(celebrationCoinCount(150), 15);
  assert.equal(celebrationCoinCount(500), CELEBRATION.maxFlyingCoins);
  assert.ok(celebrationCoinCount(75) > celebrationCoinCount(10));
});

test("pending celebration: claimed exactly once", () => {
  const store = fakeStore();
  markCelebrationPending({ sessionId: 42, coins: 75, xp: 40, durationMinutes: 25 }, store);
  const first = claimPendingCelebration(store);
  assert.ok(first);
  assert.equal(first.sessionId, 42);
  assert.equal(first.coins, 75);
  assert.equal(typeof first.createdAt, "number");
  // Second claim (reload / second tab) returns nothing.
  assert.equal(claimPendingCelebration(store), null);
});

test("pending celebration: absent flag → null", () => {
  assert.equal(claimPendingCelebration(fakeStore()), null);
});

test("pending celebration: corrupted payload is dropped, not thrown", () => {
  const store = fakeStore();
  store.setItem("energyos_pending_celebration", "{not json");
  assert.equal(claimPendingCelebration(store), null);
  assert.equal(store.getItem("energyos_pending_celebration"), null);
});

test("pending celebration: same session id can never be claimed twice", () => {
  const store = fakeStore();
  markCelebrationPending({ sessionId: 9, coins: 10, xp: 5, durationMinutes: 15 }, store);
  assert.ok(claimPendingCelebration(store));
  // Simulate the flag being rewritten for the SAME session (reload race).
  markCelebrationPending({ sessionId: 9, coins: 10, xp: 5, durationMinutes: 15 }, store);
  assert.equal(claimPendingCelebration(store), null);
});

test("pending celebration: seen marker blocks re-claim across sessions", () => {
  const store = fakeStore();
  markCelebrationPending({ sessionId: 1, coins: 10, xp: 5, durationMinutes: 15 }, store);
  assert.ok(claimPendingCelebration(store));
  // A new celebration for a DIFFERENT session still works.
  markCelebrationPending({ sessionId: 2, coins: 500, xp: 200, durationMinutes: 50 }, store);
  const second = claimPendingCelebration(store);
  assert.equal(second?.sessionId, 2);
  assert.equal(second?.coins, 500);
});

test("clearPendingCelebration removes the flag without claiming", () => {
  const store = fakeStore();
  markCelebrationPending({ sessionId: 7, coins: 10, xp: 5, durationMinutes: 15 }, store);
  clearPendingCelebration(store);
  assert.equal(claimPendingCelebration(store), null);
});

test("dev-button-shaped celebration data (10/75/500, xp = 0.6×coins) round-trips once", () => {
  // Same data shape the old "DEV: +10 / +75 / +500" buttons wrote via presentCelebration().
  for (const coins of [10, 75, 500]) {
    const store = fakeStore();
    markCelebrationPending({
      sessionId: Date.now(),
      coins,
      xp: Math.round(coins * 0.6),
      durationMinutes: 25,
      auraId: "flame",
    }, store);
    const claimed = claimPendingCelebration(store);
    assert.ok(claimed, `celebration with ${coins} coins should be claimable`);
    assert.equal(claimed.coins, coins);
    assert.equal(claimed.xp, Math.round(coins * 0.6));
    assert.equal(claimed.durationMinutes, 25);
    assert.equal(claimed.auraId, "flame");
    assert.equal(typeof claimed.createdAt, "number");
    // A second claim (reload / second tab) never replays the same session.
    assert.equal(claimPendingCelebration(store), null);
  }
});
