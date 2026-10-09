/**
 * Centralised knowledge of every `source` value written into `xp_ledger`.
 *
 * Two previously-independent schema-ensure functions (`ensureDailyTasksSchema`
 * in `daily-tasks.ts` and `ensureWeeklyPlanSeriesSchema` in
 * `weekly-plans-series.ts`) both tried to (re)create the
 * `xp_ledger_source_check` CHECK constraint — but with *different* allowed
 * lists.  The daily-tasks list omitted `weekly_plan` / `weekly_plan_occurrence`,
 * so once a weekly-plan occurrence was completed (writing a row with that
 * source) every subsequent habit request dropped the correct constraint and
 * then crashed trying to re-add the incomplete one (`check_violation` 23514),
 * taking down **all** habit endpoints with a 500.
 *
 * This module is the single source of truth for the valid source set and the
 * only place that should touch the constraint.  Both callers delegate here so
 * the lists can never drift again.
 */

import pool from "../db";

/** Every `source` value that the application ever writes to `xp_ledger`. */
export const XP_LEDGER_VALID_SOURCES = [
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
] as const;

/** SQL snippet: `'val1','val2',...` suitable for a CHECK clause. */
const SOURCES_SQL = XP_LEDGER_VALID_SOURCES.map((s) => `'${s}'`).join(",");

const CONSTRAINT_NAME = "xp_ledger_source_check";

/**
 * Ensures the `xp_ledger_source_check` CHECK constraint exists and allows
 * every source value the application may write — including the new
 * `habit_completion` source.
 *
 * Uses `NOT VALID` when creating so that existing rows are never rejected —
 * the constraint is enforced forward (on new/updates) but back-fills are safe.
 * This prevents the `check_violation` (23514) crash that happened when
 * `ensureDailyTasksSchema` rebuilt the constraint with an incomplete list
 * while a `weekly_plan_occurrence` row already existed.
 *
 * Also ensures the `coins_amount` column exists, so a habit-completion ledger
 * row can record the exact coins granted alongside its `xp_amount` (the check-in
 * row mirrors these too, in `daily_task_log`, so a future refund path never
 * refunds the wrong amount after a rule change).
 *
 * Idempotent — safe to call on every request.
 */
export async function ensureXpLedgerSourceCheck(): Promise<void> {
  // coins_amount: nullable-safe additive column (default 0 for all sources).
  await pool.query(`alter table xp_ledger add column if not exists coins_amount integer not null default 0`);

  const existing = await pool.query<{ definition: string }>(
    `select pg_get_constraintdef(oid) as definition
       from pg_constraint
      where conrelid = 'xp_ledger'::regclass
        and conname = $1
        and contype = 'c'`,
    [CONSTRAINT_NAME],
  );
  const definition = existing.rows[0]?.definition ?? "";

  // The latest addition to the valid source set is `habit_completion`. If it's
  // already in the existing constraint, the list is current and we can skip.
  // Otherwise the constraint is stale (or missing) and must be rebuilt with the
  // complete list — including `habit_completion` — so new habit rewards don't
  // crash with check_violation (23514).
  if (definition.includes("habit_completion")) {
    // Constraint already exists with the complete list — nothing to do.
    return;
  }

  // Constraint missing OR stale (incomplete list).  Rebuild it.
  await pool.query(`alter table xp_ledger drop constraint if exists ${CONSTRAINT_NAME}`);
  await pool.query(
    `alter table xp_ledger add constraint ${CONSTRAINT_NAME}
      check (source in (${SOURCES_SQL})) not valid`,
  );
}
