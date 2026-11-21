import test from "node:test";
import assert from "node:assert/strict";
import {
  SEASONS,
  getActiveSeason,
  getNextSeasonStart,
  getSeasonEndDate,
  getSeasonOverride,
  getTimeRemaining,
  isSeasonPurchasable,
  isSeasonPurchasableNow,
  seasonWindowForYear,
  spDateKey,
  type SeasonDef,
} from "./seasons";

const season = (id: string) => SEASONS.find((s) => s.id === id) as SeasonDef;

/* SP = UTC-3 (no DST). A SP wall-clock date D at 00:00 is D 03:00 UTC. */
const sp = (iso: string) => new Date(`${iso}-03:00`);

test("Halloween window: Oct 1 → Oct 31 23:59:59 SP", () => {
  const hw = season("halloween");
  assert.equal(getActiveSeason(sp("2026-10-01T00:00:00"))?.id, "halloween");
  assert.equal(getActiveSeason(sp("2026-10-15T12:00:00"))?.id, "halloween");
  assert.equal(getActiveSeason(sp("2026-10-31T23:59:59"))?.id, "halloween");
  const w = seasonWindowForYear(hw, 2026);
  assert.equal(w.end.getTime() - w.start.getTime(), 31 * 24 * 3600 * 1000 - 1);
});

test("Christmas window: Nov 1 → Dec 31 23:59:59 SP", () => {
  assert.equal(getActiveSeason(sp("2026-11-01T00:00:00"))?.id, "christmas");
  assert.equal(getActiveSeason(sp("2026-12-25T12:00:00"))?.id, "christmas");
  assert.equal(getActiveSeason(sp("2026-12-31T23:59:59"))?.id, "christmas");
});

test("New Year window: Jan 1 → Feb 5, crosses the year boundary", () => {
  assert.equal(getActiveSeason(sp("2026-01-01T00:00:00"))?.id, "newyear");
  assert.equal(getActiveSeason(sp("2026-02-05T23:59:59"))?.id, "newyear");
  // The window belongs to the same calendar year it starts in.
  assert.equal(getActiveSeason(sp("2027-01-01T00:00:00"))?.id, "newyear");
});

test("Easter window: Mar 1 → Apr 30 SP", () => {
  assert.equal(getActiveSeason(sp("2026-03-01T00:00:00"))?.id, "easter");
  assert.equal(getActiveSeason(sp("2026-04-15T12:00:00"))?.id, "easter");
  assert.equal(getActiveSeason(sp("2026-04-30T23:59:59"))?.id, "easter");
});

test("Feb 6 → Feb 28/29 has no season (incl. leap years)", () => {
  for (const y of [2026, 2028, 2032]) {
    assert.equal(getActiveSeason(sp(`${y}-02-06T12:00:00`)), null, `ano ${y}`);
    assert.equal(getActiveSeason(sp(`${y}-02-20T12:00:00`)), null, `ano ${y}`);
  }
  assert.equal(getActiveSeason(sp("2028-02-29T12:00:00")), null);
});

test("Timezone boundary: 23:59:59 vs 00:00:00 SP decides the season", () => {
  // Oct 31 23:59:59 SP = Nov 1 02:59:59 UTC — still Halloween.
  assert.equal(getActiveSeason(new Date("2026-11-01T02:59:59Z"))?.id, "halloween");
  // Nov 1 00:00:00 SP = Nov 1 03:00:00 UTC — Christmas begins.
  assert.equal(getActiveSeason(new Date("2026-11-01T03:00:00Z"))?.id, "christmas");
  // Dec 31 23:59:59 SP = Jan 1 02:59:59 UTC — still Christmas.
  assert.equal(getActiveSeason(new Date("2027-01-01T02:59:59Z"))?.id, "christmas");
  // Jan 1 00:00:00 SP = Jan 1 03:00:00 UTC — New Year begins.
  assert.equal(getActiveSeason(new Date("2027-01-01T03:00:00Z"))?.id, "newyear");
});

test("spDateKey returns the SP calendar date", () => {
  assert.equal(spDateKey(new Date("2026-11-01T02:59:59Z")), "2026-10-31");
  assert.equal(spDateKey(new Date("2026-11-01T03:00:00Z")), "2026-11-01");
});

test("getSeasonEndDate / getTimeRemaining reflect the active window", () => {
  const now = sp("2026-10-15T12:00:00");
  const end = getSeasonEndDate(season("halloween"), now);
  assert.equal(end.getTime(), sp("2026-10-31T23:59:59.999").getTime());
  const remaining = getTimeRemaining(season("halloween"), now);
  assert.ok(remaining > 16 * 24 * 3600 * 1000 && remaining < 17 * 24 * 3600 * 1000);
  assert.equal(getTimeRemaining(null, now), 0);
});

test("getNextSeasonStart rolls into next year after the window", () => {
  const now = sp("2026-11-15T12:00:00");
  // Christmas window already started → next start is next year's Nov 1.
  assert.equal(getNextSeasonStart(season("christmas"), now).getTime(), sp("2027-11-01T00:00:00").getTime());
  // Halloween hasn't started → next start is this year's Oct 1.
  assert.equal(getNextSeasonStart(season("halloween"), sp("2026-02-10T12:00:00")).getTime(), sp("2026-10-01T00:00:00").getTime());
});

test("isSeasonPurchasable / isSeasonPurchasableNow gate by window and override", () => {
  const hw = season("halloween");
  const xmas = season("christmas");
  assert.equal(isSeasonPurchasable(hw, sp("2026-10-15T12:00:00")), true);
  assert.equal(isSeasonPurchasable(hw, sp("2026-11-15T12:00:00")), false);
  assert.equal(isSeasonPurchasable(null, sp("2026-11-15T12:00:00")), false);

  // Non-seasonal items are always purchasable.
  assert.equal(isSeasonPurchasableNow(null, sp("2026-11-15T12:00:00")), true);
  // Seasonal frame of an inactive season is rejected on the server clock.
  assert.equal(isSeasonPurchasableNow("halloween", sp("2026-11-15T12:00:00")), false);
  assert.equal(isSeasonPurchasableNow("halloween", sp("2026-10-15T12:00:00")), true);

  // Dev override: allowed outside production, ignored in production.
  const env = { NODE_ENV: "development", SEASON_OVERRIDE: "halloween" };
  assert.equal(getSeasonOverride(env), "halloween");
  assert.equal(isSeasonPurchasableNow("halloween", sp("2026-11-15T12:00:00"), env), true);
  assert.equal(isSeasonPurchasableNow("christmas", sp("2026-11-15T12:00:00"), env), false);
  assert.equal(getSeasonOverride({ NODE_ENV: "production", SEASON_OVERRIDE: "halloween" }), null);
  assert.equal(isSeasonPurchasableNow("halloween", sp("2026-11-15T12:00:00"), { NODE_ENV: "production", SEASON_OVERRIDE: "halloween" }), false);

  // Unknown season ids never match.
  assert.equal(isSeasonPurchasableNow("not_a_season", sp("2026-10-15T12:00:00")), false);
  void xmas;
});
