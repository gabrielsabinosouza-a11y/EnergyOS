import test from "node:test";
import assert from "node:assert/strict";
import { formatCalendarMonth, getCalendarMonthCells } from "./calendar-grid";

test("calendar month cells align October 2026's first day to Thursday", () => {
  const cells = getCalendarMonthCells(2026, 9);

  assert.equal(cells.indexOf(1) % 7, 4);
  assert.equal(cells.length, 35);
});

test("calendar month cells align September 2026's first day to Tuesday", () => {
  const cells = getCalendarMonthCells(2026, 8);

  assert.equal(cells.indexOf(1) % 7, 2);
  assert.equal(cells.length, 35);
});

test("six-week months reserve every grid cell", () => {
  const cells = getCalendarMonthCells(2026, 4);

  assert.equal(cells.indexOf(1) % 7, 5);
  assert.equal(cells.length, 42);
});

test("Portuguese month titles capitalize only the month name", () => {
  assert.equal(formatCalendarMonth(2026, 9), "Outubro de 2026");
  assert.equal(formatCalendarMonth(2026, 8), "Setembro de 2026");
});
