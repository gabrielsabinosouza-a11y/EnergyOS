import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthGrid, isInCalendarMonth } from "./month-grid";

test("month grids start on Monday and Sunday when appropriate", () => {
  const june = buildMonthGrid(2026, 6);
  const february = buildMonthGrid(2026, 2);

  assert.equal(june.indexOf("2026-06-01") % 7, 0);
  assert.equal(february.indexOf("2026-02-01") % 7, 6);
});

test("month grids contain every day for 28, 29, 30, and 31-day months", () => {
  const cases = [
    [2021, 2, 28],
    [2024, 2, 29],
    [2026, 9, 30],
    [2026, 10, 31],
  ] as const;

  for (const [year, month, length] of cases) {
    const grid = buildMonthGrid(year, month);
    const inMonth = grid.filter((date) => isInCalendarMonth(date, year, month));
    assert.equal(inMonth.length, length);
    assert.equal(inMonth[0], `${year}-${String(month).padStart(2, "0")}-01`);
    assert.equal(inMonth.at(-1), `${year}-${String(month).padStart(2, "0")}-${length}`);
    assert.equal(grid.length % 7, 0);
  }
});

test("six-row months reserve 42 date cells", () => {
  assert.equal(buildMonthGrid(2026, 8).length, 42);
});

test("date generation remains consecutive across São Paulo DST dates", () => {
  for (const [year, month] of [[2018, 11], [2019, 2]] as const) {
    const grid = buildMonthGrid(year, month);
    const inMonth = grid.filter((date) => isInCalendarMonth(date, year, month));

    for (let index = 1; index < inMonth.length; index += 1) {
      const previousDay = Number(inMonth[index - 1].slice(-2));
      const currentDay = Number(inMonth[index].slice(-2));
      assert.equal(currentDay, previousDay + 1);
    }
  }
});
