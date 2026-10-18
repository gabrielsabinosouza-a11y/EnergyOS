-- Monthly recap finalization metadata and canonical statuses.
-- Older recap months are finalized lazily by the application from source data.

BEGIN;

ALTER TABLE monthly_recaps
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

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

CREATE INDEX IF NOT EXISTS monthly_recaps_finalized_at_idx
  ON monthly_recaps(finalized_at DESC)
  WHERE finalized_at IS NOT NULL;

COMMIT;
