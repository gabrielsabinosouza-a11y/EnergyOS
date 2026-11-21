import test from "node:test";
import assert from "node:assert/strict";
import {
  KEEP_OWNED_SEASONAL_VISIBLE,
  SEASONS,
  getActiveSeason,
  getDevNow,
  getNextSeasonStart,
  getSeasonEndDate,
  getSeasonOverride,
  getTimeRemaining,
  isSeasonalItemVisible,
  isSeasonPurchasable,
  isSeasonPurchasableNow,
  nextSeasonBoundaryMs,
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

test("New Year window: Jan 1 → Jan 31 23:59:59 SP", () => {
  assert.equal(getActiveSeason(sp("2026-01-01T00:00:00"))?.id, "newyear");
  assert.equal(getActiveSeason(sp("2026-01-31T23:59:59"))?.id, "newyear");
  // Feb 1 00:00:00 SP — New Year has ended, no season is active.
  assert.equal(getActiveSeason(sp("2026-02-01T00:00:00")), null);
  // The window belongs to the same calendar year it starts in.
  assert.equal(getActiveSeason(sp("2027-01-01T00:00:00"))?.id, "newyear");
  assert.equal(getActiveSeason(sp("2027-01-31T23:59:59"))?.id, "newyear");
  assert.equal(getActiveSeason(sp("2027-02-01T00:00:00")), null);
});

test("Easter window: Mar 1 → Apr 30 SP", () => {
  assert.equal(getActiveSeason(sp("2026-03-01T00:00:00"))?.id, "easter");
  assert.equal(getActiveSeason(sp("2026-04-15T12:00:00"))?.id, "easter");
  assert.equal(getActiveSeason(sp("2026-04-30T23:59:59"))?.id, "easter");
  // May 1 00:00:00 SP — Easter has ended.
  assert.equal(getActiveSeason(sp("2026-05-01T00:00:00")), null);
});

test("Feb has no season (incl. leap years)", () => {
  for (const y of [2026, 2028, 2032]) {
    assert.equal(getActiveSeason(sp(`${y}-02-01T00:00:00`)), null, `ano ${y}`);
    assert.equal(getActiveSeason(sp(`${y}-02-14T12:00:00`)), null, `ano ${y}`);
    assert.equal(getActiveSeason(sp(`${y}-02-28T23:59:59`)), null, `ano ${y}`);
  }
  // Leap day itself is also seasonless.
  assert.equal(getActiveSeason(sp("2028-02-29T12:00:00")), null);
  assert.equal(getActiveSeason(sp("2028-02-29T23:59:59")), null);
  // Mar 1 00:00:00 SP starts Easter, even right after Feb 29.
  assert.equal(getActiveSeason(sp("2028-03-01T00:00:00"))?.id, "easter");
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

test("Season boundaries: Oct 31→Nov 1, Dec 31→Jan 1, Jan 31→Feb 1, Apr 30→May 1", () => {
  // Halloween ends / Christmas begins.
  assert.equal(getActiveSeason(sp("2026-10-31T23:59:59"))?.id, "halloween");
  assert.equal(getActiveSeason(sp("2026-11-01T00:00:00"))?.id, "christmas");
  // Christmas ends / New Year begins (crosses the year).
  assert.equal(getActiveSeason(sp("2026-12-31T23:59:59"))?.id, "christmas");
  assert.equal(getActiveSeason(sp("2027-01-01T00:00:00"))?.id, "newyear");
  // New Year ends / nothing begins.
  assert.equal(getActiveSeason(sp("2027-01-31T23:59:59"))?.id, "newyear");
  assert.equal(getActiveSeason(sp("2027-02-01T00:00:00")), null);
  // Easter ends / nothing begins.
  assert.equal(getActiveSeason(sp("2027-04-30T23:59:59"))?.id, "easter");
  assert.equal(getActiveSeason(sp("2027-05-01T00:00:00")), null);
});

test("isSeasonalItemVisible: owned × in/out of season matrix", () => {
  const xmasActive = sp("2026-12-15T12:00:00");
  const xmasInactive = sp("2027-02-10T12:00:00"); // no season active
  const halloweenInactive = sp("2026-12-15T12:00:00"); // christmas active, halloween not

  // Inactive season + not owned → hidden.
  assert.equal(isSeasonalItemVisible("halloween", false, xmasActive), false);
  assert.equal(isSeasonalItemVisible("christmas", false, xmasInactive), false);
  // Inactive season + owned → visible only when KEEP_OWNED_SEASONAL_VISIBLE.
  assert.equal(
    isSeasonalItemVisible("christmas", true, xmasInactive),
    KEEP_OWNED_SEASONAL_VISIBLE,
  );
  // Active season → visible to everyone.
  assert.equal(isSeasonalItemVisible("christmas", false, xmasActive), true);
  assert.equal(isSeasonalItemVisible("christmas", true, xmasActive), true);
  // Non-seasonal items are always visible.
  assert.equal(isSeasonalItemVisible(null, false, xmasInactive), true);
  // Dev override flips visibility the same way getActiveSeason does.
  assert.equal(
    isSeasonalItemVisible("halloween", false, xmasActive, "halloween"),
    true,
  );
  assert.equal(
    isSeasonalItemVisible("christmas", false, halloweenInactive, "halloween"),
    false,
  );
});

test("nextSeasonBoundaryMs points at the nearest window edge", () => {
  // Mid-Halloween → next boundary is Nov 1 00:00 SP (Christmas start).
  const midHalloween = sp("2026-10-15T12:00:00");
  const wait = nextSeasonBoundaryMs(midHalloween);
  const expected = sp("2026-11-01T00:00:00").getTime() - midHalloween.getTime();
  assert.ok(Math.abs(wait - expected) < 60_000, `wait=${wait} expected≈${expected}`);
  // Jan 20 → next boundary is Feb 1? No — New Year ends Jan 31 23:59:59.999,
  // so the boundary is Feb 1 00:00 SP.
  const jan20 = sp("2027-01-20T12:00:00");
  const wait2 = nextSeasonBoundaryMs(jan20);
  const expected2 = sp("2027-02-01T00:00:00").getTime() - jan20.getTime();
  assert.ok(Math.abs(wait2 - expected2) < 60_000, `wait2=${wait2} expected≈${expected2}`);
});

test("getDevNow parses ?now= outside production only", () => {
  const dev = { NODE_ENV: "development" };
  assert.equal(getDevNow(dev, "?now=2026-12-31T23:59:50")?.getTime(), Date.parse("2026-12-31T23:59:50"));
  assert.equal(getDevNow(dev, "?now=not-a-date"), null);
  assert.equal(getDevNow(dev, ""), null);
  assert.equal(getDevNow({ NODE_ENV: "production" }, "?now=2026-12-31T23:59:50"), null);
});
