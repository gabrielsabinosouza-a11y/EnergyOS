ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS times_top_1_global integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_top_1_global_week date;

ALTER TABLE league_groups
  ADD COLUMN IF NOT EXISTS reset_at timestamptz;

CREATE TABLE IF NOT EXISTS league_weekly_results (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_group_id bigint NOT NULL REFERENCES league_groups(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  tier league_tier NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  weekly_xp integer NOT NULL DEFAULT 0,
  result text NOT NULL CHECK (result IN ('promoted', 'demoted', 'stayed')),
  resulting_tier league_tier NOT NULL,
  coins_awarded integer NOT NULL DEFAULT 0 CHECK (coins_awarded >= 0),
  zone text NOT NULL CHECK (zone IN ('promotion', 'reward', 'safe', 'demotion')),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_group_id, profile_id)
);

CREATE INDEX IF NOT EXISTS league_weekly_results_pending_idx
  ON league_weekly_results(profile_id, week_start_date DESC)
  WHERE notified_at IS NULL;

CREATE TABLE IF NOT EXISTS coin_transactions (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  tier league_tier NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  week_start_date date NOT NULL,
  league_group_id bigint NOT NULL REFERENCES league_groups(id) ON DELETE CASCADE,
  reference_key text NOT NULL UNIQUE,
  reward_kind text NOT NULL CHECK (reward_kind IN ('podium', 'top1_global_unlock')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_transactions_profile_idx
  ON coin_transactions(profile_id, created_at DESC);

INSERT INTO achievements (id, title, description, category)
VALUES ('top_1_global', 'Top 1 Global', 'Termine em 1º lugar na Liga Lendas', 'league')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

UPDATE achievements
SET title = 'Líder do Núcleo',
    description = 'Lidere a antiga liga Núcleo'
WHERE id = 'rarest_aura';
