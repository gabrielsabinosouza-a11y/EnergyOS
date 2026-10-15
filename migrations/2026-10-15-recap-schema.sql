-- Idempotent migration: monthly_recaps schema (unique constraint, status,
-- generation tracking and history table).
--
-- Applies with: psql "$DATABASE_URL" -f migrations/2026-10-15-recap-schema.sql
-- Safe to re-run: every statement is idempotent.

-- ─── Unique constraint: one recap per (profile, month) ─────────────────────
-- A recap is uniquely identified by (profile_id, recap_month). Regenerating
-- the same month must UPDATE the same row (upsert), never duplicate it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'monthly_recaps'::regclass
      and contype = 'u'
      and conname = 'monthly_recaps_profile_id_recap_month_key'
  ) then
    alter table monthly_recaps
      add constraint monthly_recaps_profile_id_recap_month_key
      unique (profile_id, recap_month);
  end if;
end $$;

-- ─── Columns added after the original table was created ────────────────────
do $$ begin
  alter table monthly_recaps add column if not exists league_at_start text;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table monthly_recaps add column if not exists generation_number integer not null default 1;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table monthly_recaps add column if not exists xp_sources jsonb;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table monthly_recaps add column if not exists streak_start_date date;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table monthly_recaps add column if not exists streak_end_date date;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table monthly_recaps add column if not exists streak_is_alive boolean not null default false;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table monthly_recaps add column if not exists status text not null default 'parcial';
exception when duplicate_column then null; end $$;

-- ─── Status check constraint ───────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'monthly_recaps'::regclass
      and conname = 'monthly_recaps_status_check'
  ) then
    alter table monthly_recaps
      add constraint monthly_recaps_status_check
      check (status = any (array['parcial'::text, 'final'::text]));
  end if;
end $$;

-- ─── Deduplicate any existing (profile_id, recap_month) duplicates ─────────
-- Keep the most recently computed row (highest id / generated_at) and delete
-- the rest, so the unique constraint above can be enforced safely.
do $$
begin
  if exists (
    select 1 from monthly_recaps
    group by profile_id, recap_month
    having count(*) > 1
    limit 1
  ) then
    delete from monthly_recaps m
    using monthly_recaps m2
    where m.profile_id = m2.profile_id
      and m.recap_month = m2.recap_month
      and m.id < m2.id;
  end if;
end $$;

-- ─── History table (snapshots of previous generations) ─────────────────────
create table if not exists monthly_recap_history (
  id integer primary key generated always as identity,
  recap_id bigint not null references monthly_recaps(id) on delete cascade,
  profile_id text not null,
  recap_month date not null,
  total_focus_minutes integer not null default 0,
  longest_streak integer not null default 0,
  streak_start_date date,
  streak_end_date date,
  streak_is_alive boolean not null default false,
  league_at_start text,
  league_at_end text,
  league_promoted boolean default false,
  productivity_tag text,
  garden_count integer not null default 0,
  total_xp integer not null default 0,
  xp_sources jsonb,
  generation_number integer not null,
  generation_count integer not null,
  generated_at timestamptz not null default now()
);

create index if not exists monthly_recap_history_recap_id_idx
  on monthly_recap_history(recap_id);
