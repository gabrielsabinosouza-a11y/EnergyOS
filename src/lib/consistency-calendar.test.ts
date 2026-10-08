import test from "node:test";
import assert from "node:assert/strict";
import { buildConsistencyWeeks, consistencyDatePosition } from "./consistency-calendar";

test("2026 dates align to Monday-first columns and weekday rows", () => {
  assert.deepEqual(consistencyDatePosition("2026-01-01", 2026), { column: 0, row: 3 }); // Thursday
  assert.deepEqual(consistencyDatePosition("2026-06-12", 2026), { column: 23, row: 4 }); // Friday
  assert.deepEqual(consistencyDatePosition("2026-10-08", 2026), { column: 40, row: 3 }); // Thursday
  assert.equal(consistencyDatePosition("2025-12-31", 2026), null);
});

test("the year matrix has aligned placeholders and a dynamic number of weeks", () => {
  const weeks = buildConsistencyWeeks(2026, [], "2026-10-08");
  assert.equal(weeks.length, 53);
  assert.equal(weeks[0][0], null);
  assert.equal(weeks[0][3]?.date, "2026-01-01");
  assert.equal(weeks.at(-1)?.[5], null);
  assert.equal(buildConsistencyWeeks(2025, [], "2026-10-08").length, 53);
});
