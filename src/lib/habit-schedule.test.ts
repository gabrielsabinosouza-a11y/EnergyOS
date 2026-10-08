import test from "node:test";
import assert from "node:assert/strict";
import { isHabitScheduledOnDate, scheduledWeekdays } from "./habit-schedule";

test("weekdays frequency only schedules selected local weekdays", () => {
  assert.equal(isHabitScheduledOnDate("weekdays", [1, 3, 5], null, "2026-10-05"), true);
  assert.equal(isHabitScheduledOnDate("weekdays", [1, 3, 5], null, "2026-10-06"), false);
});

test("weekly target is distributed deterministically from Monday", () => {
  assert.deepEqual(scheduledWeekdays(3), [1, 3, 5]);
  assert.equal(isHabitScheduledOnDate("times_per_week", null, 3, "2026-10-07"), true);
  assert.equal(isHabitScheduledOnDate("times_per_week", null, 3, "2026-10-06"), false);
});

test("daily habits remain scheduled every weekday", () => {
  for (const day of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]) {
    assert.equal(isHabitScheduledOnDate("daily", null, null, day), true);
  }
});
