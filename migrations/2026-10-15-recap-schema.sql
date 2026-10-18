-- Monthly recap schema: one row per profile/month, with a snapshot history.
-- Duplicate recaps are reported for manual resolution; this migration never
-- deletes existing recap records.

BEGIN;

ALTER TABLE monthly_recaps
  ADD COLUMN IF NOT EXISTS league_at_start text,
  ADD COLUMN IF NOT EXISTS generation_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_sources jsonb,
  ADD COLUMN IF NOT EXISTS streak_start_date date,
  ADD COLUMN IF NOT EXISTS streak_end_date date,
  ADD COLUMN IF NOT EXISTS streak_is_alive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'live';

DO $$
DECLARE
  profile_attnum smallint;
  month_attnum smallint;
BEGIN
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

-- Accept only known legacy/current statuses, replace old checks before
-- normalizing rows, then enforce the values used by the application.
DO $$
DECLARE
  status_attnum smallint;
  status_constraint record;
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

  ALTER TABLE monthly_recaps
    ADD CONSTRAINT monthly_recaps_status_check
    CHECK (status IN ('live', 'final'));
END $$;

CREATE TABLE IF NOT EXISTS monthly_recap_history (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  recap_id bigint NOT NULL REFERENCES monthly_recaps(id) ON DELETE CASCADE,
  profile_id text NOT NULL,
  recap_month date NOT NULL,
  total_focus_minutes integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  streak_start_date date,
  streak_end_date date,
  streak_is_alive boolean NOT NULL DEFAULT false,
  league_at_start text,
  league_at_end text,
  league_promoted boolean DEFAULT false,
  productivity_tag text,
  garden_count integer NOT NULL DEFAULT 0,
  total_xp integer NOT NULL DEFAULT 0,
  xp_sources jsonb,
  generation_number integer NOT NULL,
  generation_count integer NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monthly_recap_history_recap_id_idx
  ON monthly_recap_history(recap_id);

COMMIT;
