
-- Monthly Recap enhancements
-- Safe to re-run for the listed columns, constraint and index.

BEGIN;

-- Step 1: Add recap columns.
ALTER TABLE monthly_recaps
  ADD COLUMN IF NOT EXISTS coins_gained integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missions_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievements_unlocked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_focus_category text;

-- Step 2: Add history columns.
ALTER TABLE monthly_recap_history
  ADD COLUMN IF NOT EXISTS coins_gained integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missions_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievements_unlocked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_focus_category text;

-- Step 3: Normalize statuses before adding the final constraint.
ALTER TABLE monthly_recaps
  DROP CONSTRAINT IF EXISTS monthly_recaps_status_check;

UPDATE monthly_recaps
SET status = 'live'
WHERE status = 'parcial';

ALTER TABLE monthly_recaps
  ADD CONSTRAINT monthly_recaps_status_check
  CHECK (status IN ('live', 'final'));

-- Step 4: Do not alter primary-key or unique constraints here.
-- The existing schema already defines uniqueness for profile/month.

-- Step 5: Add the category index.
CREATE INDEX IF NOT EXISTS monthly_recaps_top_focus_category_idx
  ON monthly_recaps (top_focus_category)
  WHERE top_focus_category IS NOT NULL;

COMMIT;
