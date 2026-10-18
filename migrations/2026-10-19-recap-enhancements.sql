-- Monthly recap metrics and status normalization.
-- Duplicate profile/month rows and unknown statuses are reported, never deleted
-- or silently coerced.

BEGIN;

ALTER TABLE monthly_recaps
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS coins_gained integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missions_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievements_unlocked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_focus_category text;

ALTER TABLE monthly_recap_history
  ADD COLUMN IF NOT EXISTS coins_gained integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missions_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievements_unlocked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_focus_category text;

UPDATE monthly_recaps
SET coins_gained = COALESCE(coins_gained, 0),
    coins_spent = COALESCE(coins_spent, 0),
    missions_completed = COALESCE(missions_completed, 0),
    goals_completed = COALESCE(goals_completed, 0),
    achievements_unlocked = COALESCE(achievements_unlocked, 0);

UPDATE monthly_recap_history
SET coins_gained = COALESCE(coins_gained, 0),
    coins_spent = COALESCE(coins_spent, 0),
    missions_completed = COALESCE(missions_completed, 0),
    goals_completed = COALESCE(goals_completed, 0),
    achievements_unlocked = COALESCE(achievements_unlocked, 0);

ALTER TABLE monthly_recaps
  ALTER COLUMN coins_gained SET DEFAULT 0,
  ALTER COLUMN coins_gained SET NOT NULL,
  ALTER COLUMN coins_spent SET DEFAULT 0,
  ALTER COLUMN coins_spent SET NOT NULL,
  ALTER COLUMN missions_completed SET DEFAULT 0,
  ALTER COLUMN missions_completed SET NOT NULL,
  ALTER COLUMN goals_completed SET DEFAULT 0,
  ALTER COLUMN goals_completed SET NOT NULL,
  ALTER COLUMN achievements_unlocked SET DEFAULT 0,
  ALTER COLUMN achievements_unlocked SET NOT NULL;

ALTER TABLE monthly_recap_history
  ALTER COLUMN coins_gained SET DEFAULT 0,
  ALTER COLUMN coins_gained SET NOT NULL,
  ALTER COLUMN coins_spent SET DEFAULT 0,
  ALTER COLUMN coins_spent SET NOT NULL,
  ALTER COLUMN missions_completed SET DEFAULT 0,
  ALTER COLUMN missions_completed SET NOT NULL,
  ALTER COLUMN goals_completed SET DEFAULT 0,
  ALTER COLUMN goals_completed SET NOT NULL,
  ALTER COLUMN achievements_unlocked SET DEFAULT 0,
  ALTER COLUMN achievements_unlocked SET NOT NULL;

DO $$
DECLARE
  status_attnum smallint;
  status_constraint record;
  profile_attnum smallint;
  month_attnum smallint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM monthly_recaps
    WHERE status NOT IN ('live', 'final', 'parcial')
  ) THEN
    RAISE EXCEPTION 'monthly_recaps contains an unknown status; inspect rows before migration';
  END IF;

  SELECT attnum INTO status_attnum
  FROM pg_attribute
  WHERE attrelid = 'monthly_recaps'::regclass AND attname = 'status' AND NOT attisdropped;

  FOR status_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'monthly_recaps'::regclass
      AND contype = 'c'
      AND conkey @> ARRAY[status_attnum]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE monthly_recaps DROP CONSTRAINT %I', status_constraint.conname);
  END LOOP;

  UPDATE monthly_recaps SET status = 'live' WHERE status = 'parcial';
  UPDATE monthly_recaps
  SET finalized_at = generated_at
  WHERE status = 'final' AND finalized_at IS NULL;

  ALTER TABLE monthly_recaps
    ADD CONSTRAINT monthly_recaps_status_check
    CHECK (status IN ('live', 'final'));

  SELECT attnum INTO profile_attnum
  FROM pg_attribute
  WHERE attrelid = 'monthly_recaps'::regclass AND attname = 'profile_id' AND NOT attisdropped;

  SELECT attnum INTO month_attnum
  FROM pg_attribute
  WHERE attrelid = 'monthly_recaps'::regclass AND attname = 'recap_month' AND NOT attisdropped;

  IF EXISTS (
    SELECT 1 FROM monthly_recaps
    GROUP BY profile_id, recap_month
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'monthly_recaps contains duplicate (profile_id, recap_month) rows; resolve them before adding uniqueness';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'monthly_recaps'::regclass
      AND contype IN ('u', 'p')
      AND conkey = ARRAY[profile_attnum, month_attnum]::smallint[]
  ) THEN
    ALTER TABLE monthly_recaps
      ADD CONSTRAINT monthly_recaps_profile_month_unique
      UNIQUE (profile_id, recap_month);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS monthly_recaps_top_focus_category_idx
  ON monthly_recaps (top_focus_category)
  WHERE top_focus_category IS NOT NULL;

COMMIT;
