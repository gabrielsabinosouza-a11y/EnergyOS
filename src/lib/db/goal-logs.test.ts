import test from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_LOG_ACTIONS,
  goalRewardSourceKey,
  resetGoalProgressInTransaction,
} from "./goal-logs";

test("goal logs accept the explicit reset action", () => {
  assert.ok(GOAL_LOG_ACTIONS.includes("reset"));
});

test("reopening a unique goal keeps the same completion reward ledger key", () => {
  const beforeReset = goalRewardSourceKey(42, "unique", "2026-04-10");
  const afterReset = goalRewardSourceKey(42, "unique", "2026-04-11");
  assert.equal(afterReset, beforeReset);
});

test("reset records a new baseline and preserves historical goal logs", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  await resetGoalProgressInTransaction(
    {
      query: async (sql, values) => {
        queries.push({ sql, values });
      },
    },
    "profile-1",
    42,
  );

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /progress_reset_at = now\(\), completed_at = null/);
  assert.match(queries[0].sql, /where profile_id = \$1 and id = \$2/);
  assert.doesNotMatch(queries[0].sql, /delete from goal_logs/i);
  assert.deepEqual(queries[0].values, ["profile-1", 42]);
});
