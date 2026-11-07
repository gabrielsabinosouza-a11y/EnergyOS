-- PRODUCTION SCHEMA FIX GUIDE
-- 
-- This document shows all unapplied migrations that must be applied to fix the 500 errors.
-- 
-- BEFORE RUNNING:
-- 1. Create a Neon branch: neon branches create --name fix-schema-drift
-- 2. Get the branch connection string
-- 3. Run each migration in order
-- 4. Test the endpoints
-- 5. If successful, apply to production
-- 6. Delete the branch
--
-- All migrations are idempotent (safe to run multiple times).

-- ============================================================================
-- MIGRATION 1: 2026-10-14-focus-room-timer.sql
-- Adds pause tracking to focus_sessions
-- ============================================================================

ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS room_id bigint references focus_rooms(id) on delete set null;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS energy_type text;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS paused_count integer;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS end_reason text;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS focused_seconds integer not null default 0;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS total_paused_seconds integer not null default 0;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS away_started_at timestamptz;

-- ============================================================================
-- MIGRATION 2: 2026-11-04-focus-grace-period.sql
-- Adds grace period tracking (already covered by migration 1)
-- ============================================================================

-- Already covered above

-- ============================================================================
-- MIGRATION 3: 2026-10-18-xp-boost-purchase-idempotency.sql
-- Creates xp_boost_purchase_requests table for idempotent purchases
-- ============================================================================

CREATE TABLE IF NOT EXISTS xp_boost_purchase_requests (
  profile_id text not null references profiles(id) on delete cascade,
  idempotency_key uuid not null,
  requested_quantity integer not null,
  balance integer not null,
  potion_quantity integer not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, idempotency_key)
);

-- ============================================================================
-- MIGRATION 4: 2026-11-08-weekly-plan-reminder-offset.sql
-- Adds reminder_offset_min to weekly plan series
-- ============================================================================

ALTER TABLE weekly_plan_series ADD COLUMN IF NOT EXISTS reminder_offset_min int;
ALTER TABLE weekly_plan_occurrences ADD COLUMN IF NOT EXISTS reminder_offset_min int;

-- ============================================================================
-- MIGRATION 5: Ensure profiles columns for top_1_global achievement
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS times_top_1_global integer not null default 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_top_1_global_week date;

-- ============================================================================
-- MIGRATION 6: Ensure league_groups.reset_at column
-- ============================================================================

ALTER TABLE league_groups ADD COLUMN IF NOT EXISTS reset_at timestamptz;

-- ============================================================================
-- SEED: Insert missing achievements
-- ============================================================================

INSERT INTO achievements (id, title, description, category) VALUES
  ('streak_master',    'Mestre da Sequência',  'Mantenha sequências de consistência',           'streak'),
  ('deep_focus',       'Foco Profundo',        'Complete sessões longas de foco',               'focus'),
  ('early_riser',      'Madrugador',           'Faça check-in antes das 7h',                    'checkin'),
  ('sleep_champion',   'Campeão do Sono',      'Durma 7 horas ou mais',                         'sleep'),
  ('consistency_king', 'Rei da Consistência',  'Semanas perfeitas de foco',                'checkin'),
  ('xp_olympian',      'Olimpiano de XP',      'Acumule minutos de foco ao longo da vida',      'focus'),
  ('social_spark',     'Faísca Social',        'Faça amigos e entre em grupos',                 'social'),
  ('rarest_aura',      'Líder do Núcleo',       'Lidere a antiga liga Núcleo',                    'league'),
  ('top_1_global',     'Top 1 Global',          'Termine em 1º lugar na Liga Lendas',              'league'),
  ('squad_leader',     'Líder de Esquadrão',   'Tenha o maior grupo onde você é dono',             'social'),
  ('focus_companion',  'Companheiro de Foco', 'Conclua sessões focando com outras pessoas',  'focus'),
  ('flow_state',       'Estado de Fluxo',     'Complete uma sessão de foco ininterrupta',      'focus'),
  ('aura_collector',   'Colecionador de Auras','Colecione uma porcentagem das auras disponíveis','aura')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all columns exist:
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'focus_sessions' AND column_name IN ('paused_at', 'away_started_at', 'end_reason')
ORDER BY column_name;

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'league_groups' AND column_name = 'reset_at';

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('times_top_1_global', 'last_top_1_global_week')
ORDER BY column_name;

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'weekly_plan_series' AND column_name = 'reminder_offset_min';

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'xp_boost_purchase_requests';

SELECT id, title FROM achievements WHERE id = 'top_1_global';

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

-- All queries above should return rows. If any return empty, the migration failed.
-- 
-- focus_sessions columns:
--   away_started_at | timestamp with time zone
--   end_reason      | text
--   paused_at       | timestamp with time zone
--
-- league_groups columns:
--   reset_at        | timestamp with time zone
--
-- profiles columns:
--   last_top_1_global_week | date
--   times_top_1_global     | integer
--
-- weekly_plan_series columns:
--   reminder_offset_min | integer
--
-- xp_boost_purchase_requests table: should exist
--
-- achievements:
--   top_1_global | Top 1 Global | Termine em 1º lugar na Liga Lendas | league
