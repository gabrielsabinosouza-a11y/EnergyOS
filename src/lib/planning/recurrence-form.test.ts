import test from "node:test";
import assert from "node:assert/strict";
import { firstWeeklyOccurrence, recurrenceInitialDate, syncInitialWeekday, validateWeeklyRecurrence } from "./recurrence-form";

test("prefill prefers an explicit day, then selected day, then today", () => {
  assert.equal(recurrenceInitialDate("2026-10-26", "2026-10-25", "2026-10-22"), "2026-10-26");
  assert.equal(recurrenceInitialDate(null, "2026-10-26", "2026-10-22"), "2026-10-26");
  assert.equal(recurrenceInitialDate(null, null, "2026-10-22"), "2026-10-22");
});

test("initial weekday sync uses the planner's local calendar weekday", () => {
  assert.deepEqual(syncInitialWeekday("2026-10-26"), [1]); // Monday (Seg)
});

test("first occurrence is the next selected weekday on or after the anchor", () => {
  assert.equal(firstWeeklyOccurrence("2026-10-26", [1, 4]), "2026-10-26");
  assert.equal(firstWeeklyOccurrence("2026-10-26", [4, 5]), "2026-10-29");
  assert.equal(firstWeeklyOccurrence("2026-12-31", [1]), "2027-01-04");
});

test("weekly recurrence requires an end date when that end condition is selected and rejects an earlier date", () => {
  assert.equal(validateWeeklyRecurrence({ startDate: "2026-10-26", days: [1], hasEndDate: true, endDate: null }).repeatUntil, "Selecione a data final.");
  assert.equal(validateWeeklyRecurrence({ startDate: "2026-10-26", days: [1], hasEndDate: true, endDate: "2026-10-25" }).repeatUntil, "A data final deve ser igual ou posterior à data inicial.");
  assert.deepEqual(validateWeeklyRecurrence({ startDate: "2026-10-26", days: [1], hasEndDate: true, endDate: "2026-10-26" }), {});
});

test("weekly recurrence rejects an empty weekday selection", () => {
  assert.equal(validateWeeklyRecurrence({ startDate: "2026-10-26", days: [], hasEndDate: false, endDate: null }).repeatDays, "Selecione pelo menos um dia da semana.");
  assert.equal(firstWeeklyOccurrence("2026-10-26", []), null);
});
