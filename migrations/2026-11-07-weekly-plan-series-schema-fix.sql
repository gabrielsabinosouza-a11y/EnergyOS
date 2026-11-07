-- Planner schema fix (idempotent). Safe to run more than once.
--
-- Context: converting a one-time weekly plan to a recurring series failed with
--   42703: column "reminder_offset_min" of relation "weekly_plan_series" does not exist
-- because the live DB was missing columns present in code.
--
-- Column types/defaults derived from current code and existing schema:
--   reminder_offset_min: integer, nullable, no default (same as weekly_plans.reminder_offset_min
--     and weekly_plan_series/occurrences definitions in scripts/migrate-planner-series.mjs and schema dumps).
--   override_category_id: integer, nullable, FK -> categories(id) ON DELETE SET NULL
--     (same reference pattern as weekly_plans/series category_id; used by weekly_plan_occurrences
--     override reads/writes in src/lib/db/weekly-plans-series.ts).

ALTER TABLE weekly_plan_series
  ADD COLUMN IF NOT EXISTS reminder_offset_min integer;

ALTER TABLE weekly_plan_occurrences
  ADD COLUMN IF NOT EXISTS reminder_offset_min integer;

ALTER TABLE weekly_plan_occurrences
  ADD COLUMN IF NOT EXISTS override_category_id integer REFERENCES categories(id) ON DELETE SET NULL;
