import test from "node:test";
import assert from "node:assert/strict";
import { XP_LEDGER_VALID_SOURCES } from "./xp-ledger";

test("XP_LEDGER_VALID_SOURCES includes every source written by the application", () => {
  // These are the source values passed to creditXP() across the codebase.
  // If a new source is added without updating this list, ensureXpLedgerSourceCheck
  // will create a constraint that rejects the new value at write time.
  const sourcesUsedInCodebase = [
    "task",
    "kanban",
    "kanban_task",
    "weekly_plan",
    "weekly_plan_occurrence",
    "focus",
    "streak_bonus",
    "daily_quest",
    "habit_completion",
    "daily_task",
    "checkin",
    "checkin_streak",
    "goal",
    "achievement",
  ];

  for (const source of sourcesUsedInCodebase) {
    assert.ok(
      XP_LEDGER_VALID_SOURCES.includes(source as typeof XP_LEDGER_VALID_SOURCES[number]),
      `Source "${source}" is used by the application but missing from XP_LEDGER_VALID_SOURCES`,
    );
  }
});

test("XP_LEDGER_VALID_SOURCES includes weekly_plan and weekly_plan_occurrence", () => {
  // Regression test for the original bug: the daily-tasks schema ensure function
  // omitted these two values, causing a check_violation (23514) when a weekly
  // plan occurrence wrote to xp_ledger.
  assert.ok(XP_LEDGER_VALID_SOURCES.includes("weekly_plan"));
  assert.ok(XP_LEDGER_VALID_SOURCES.includes("weekly_plan_occurrence"));
});
