/**
 * Schema-sync health check.
 *
 * Run in dev boot or CI to detect drift between the database schema and what
 * the application code expects — before it causes 500s for users.
 *
 * The original regression was caused by `ensureDailyTasksSchema()` rebuilding
 * the `xp_ledger_source_check` CHECK constraint with an incomplete source list
 * (missing `weekly_plan` / `weekly_plan_occurrence`), which crashed every time
 * a weekly-plan occurrence had already written to `xp_ledger`.
 *
 * This check verifies the critical invariants at startup and fails fast with
 * actionable diagnostics instead of waiting for a user request to blow up.
 */
import pool from "../db";
import { XP_LEDGER_VALID_SOURCES } from "./xp-ledger";

export interface SchemaIssue {
  table: string;
  issue: string;
  severity: "error" | "warn";
}

export interface SchemaCheckResult {
  ok: boolean;
  issues: SchemaIssue[];
}

const EXPECTED_COLUMNS: Record<string, string[]> = {
  profile_daily_tasks: [
    "id",
    "profile_id",
    "title",
    "is_active",
    "sort_order",
    "created_at",
    "icon_type",
    "icon_value",
    "color",
    "frequency_type",
    "frequency_days",
    "frequency_target",
    "goal_type",
    "target_value",
    "unit",
    "current_progress",
    "description",
    "category",
    "start_date",
    "reminder_time",
    "archived",
    "daily_target",
  ],
  daily_task_log: [
    "task_id",
    "log_date",
    "is_completed",
    "completed_at",
    "completion_count",
    "rewards_claimed",
    "progress_value",
  ],
};

/**
 * Returns true if the xp_ledger `source` column can accept every value the
 * application writes.  This is the check that, if it had existed at boot time,
 * would have caught the original regression before any user request ran.
 */
export function sourcesAreCovered(allowedSources: string[]): boolean {
  return XP_LEDGER_VALID_SOURCES.every((s) => allowedSources.includes(s));
}

/** Verifies the critical schema elements that the habit system depends on. */
export async function verifySchema(): Promise<SchemaCheckResult> {
  const issues: SchemaIssue[] = [];

  for (const [table, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
    const result = await pool.query(
      `select column_name from information_schema.columns where table_name = $1 and column_name = any($2::text[])`,
      [table, expectedCols],
    );
    const found = new Set(result.rows.map((r) => r.column_name as string));
    for (const col of expectedCols) {
      if (!found.has(col)) {
        issues.push({ table, issue: `missing column "${col}"`, severity: "error" });
      }
    }
  }

  // Verify the xp_ledger_source_check constraint exists with ALL valid sources.
  const constraint = await pool.query<{ definition: string }>(
    `select pg_get_constraintdef(oid) as definition
       from pg_constraint
      where conrelid = 'xp_ledger'::regclass
        and conname = 'xp_ledger_source_check'
        and contype = 'c'`,
  );
  const definition = constraint.rows[0]?.definition ?? "";

  if (!definition) {
    issues.push({
      table: "xp_ledger",
      issue: "xp_ledger_source_check CHECK constraint is missing",
      severity: "warn",
    });
  } else {
    for (const source of XP_LEDGER_VALID_SOURCES) {
      if (!definition.includes(`'${source}'`)) {
        issues.push({
          table: "xp_ledger",
          issue: `xp_ledger_source_check is missing source '${source}' in its allowed list`,
          severity: "error",
        });
      }
    }
  }

  // Verify the unique index that makes check-ins idempotent.
  const indexCheck = await pool.query<{ exists: boolean }>(
    `select exists (
      select 1 from pg_constraint
      where conrelid = 'daily_task_log'::regclass
        and conname = 'daily_task_log_pkey'
        and contype = 'p'
    ) as exists`,
  );
  if (!indexCheck.rows[0]?.exists) {
    issues.push({
      table: "daily_task_log",
      issue: "primary key (task_id, log_date) is missing — idempotency at risk",
      severity: "error",
    });
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
