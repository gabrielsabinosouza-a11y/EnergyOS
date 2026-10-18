-- Normalize the legacy goals schema without deleting goals or hiding failures.
-- Unmapped categories and unknown frequency values abort the transaction with
-- counts so they can be reviewed before this migration is retried.

BEGIN;

ALTER TABLE goals ADD COLUMN IF NOT EXISTS category_id bigint;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
DECLARE
  legacy_category_exists boolean;
  missing_category_count bigint;
  frequency_attnum smallint;
  frequency_constraint record;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'goals'
      AND column_name = 'category'
  ) INTO legacy_category_exists;

  IF legacy_category_exists THEN
    UPDATE goals g
    SET category_id = COALESCE(
      (
        SELECT c.id
        FROM categories c
        WHERE c.user_id IS NULL
          AND lower(c.name) = lower(
            CASE lower(g.category)
              WHEN 'sono' THEN 'Sono'
              WHEN 'estudo' THEN 'Estudo'
              WHEN 'treino' THEN 'Treino'
              WHEN 'saude' THEN 'Saúde'
              WHEN 'foco' THEN 'Foco'
              ELSE 'Outros'
            END
          )
        LIMIT 1
      ),
      (
        SELECT c.id
        FROM categories c
        WHERE c.user_id IS NULL AND lower(c.name) = 'outros'
        LIMIT 1
      )
    )
    WHERE g.category_id IS NULL;
  END IF;

  SELECT count(*) INTO missing_category_count
  FROM goals
  WHERE category_id IS NULL;

  IF missing_category_count > 0 THEN
    RAISE EXCEPTION '% goal rows have no category mapping; resolve category data before migration', missing_category_count;
  END IF;

  IF legacy_category_exists THEN
    ALTER TABLE goals DROP COLUMN category;
  END IF;

  ALTER TABLE goals ALTER COLUMN category_id SET NOT NULL;

  SELECT attnum INTO frequency_attnum
  FROM pg_attribute
  WHERE attrelid = 'goals'::regclass AND attname = 'frequency' AND NOT attisdropped;

  FOR frequency_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'goals'::regclass
      AND contype = 'c'
      AND conkey @> ARRAY[frequency_attnum]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE goals DROP CONSTRAINT %I', frequency_constraint.conname);
  END LOOP;

  UPDATE goals
  SET frequency = CASE lower(frequency)
    WHEN 'daily' THEN 'daily'
    WHEN 'weekly' THEN 'weekly'
    WHEN 'monthly' THEN 'monthly'
    WHEN 'unique' THEN 'unique'
    WHEN 'única' THEN 'unique'
    WHEN 'unica' THEN 'unique'
    WHEN 'mensal' THEN 'monthly'
    WHEN 'diária' THEN 'daily'
    WHEN 'diaria' THEN 'daily'
    WHEN 'diario' THEN 'daily'
    WHEN 'semanal' THEN 'weekly'
    ELSE frequency
  END
  WHERE frequency NOT IN ('daily', 'weekly', 'monthly', 'unique');

  IF EXISTS (
    SELECT 1 FROM goals
    WHERE frequency IS NULL
       OR frequency NOT IN ('daily', 'weekly', 'monthly', 'unique')
  ) THEN
    RAISE EXCEPTION 'goals contains unknown frequency values; review them before migration';
  END IF;

  ALTER TABLE goals ALTER COLUMN frequency SET DEFAULT 'unique';
  ALTER TABLE goals
    ADD CONSTRAINT goals_frequency_check
    CHECK (frequency IN ('daily', 'weekly', 'monthly', 'unique')) NOT VALID;
  ALTER TABLE goals VALIDATE CONSTRAINT goals_frequency_check;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'goals'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'goals'::regclass AND attname = 'category_id' AND NOT attisdropped)
      ]::smallint[]
      AND confrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE goals
      ADD CONSTRAINT goals_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS goals_profile_deadline_idx ON goals(profile_id, deadline);
CREATE INDEX IF NOT EXISTS goals_category_id_idx ON goals(category_id);

CREATE TABLE IF NOT EXISTS goal_logs (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id bigint NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  amount numeric(8,2) NOT NULL DEFAULT 1 CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, log_date)
);

CREATE INDEX IF NOT EXISTS goal_logs_profile_date_idx ON goal_logs(profile_id, log_date);

COMMIT;
