-- Migration: Normalize goals schema, frequency values, and ensure constraints
--
-- This migration fixes several issues with the goals table:
-- 1. Normalizes frequency values that may have been stored as Portuguese labels
-- 2. Ensures the goals_frequency_check constraint allows correct values
-- 3. Adds category_id column with foreign key (if not exists)
-- 4. Adds unit, deadline, completed_at columns
-- 5. Creates goal_logs table for progress tracking
--
-- Apply with: psql "$DATABASE_URL" -f migrations/2026-10-15-goals-frequency-fix.sql
-- Safe to re-run: every statement is idempotent.

-- ============================================================================
-- Step 1: Ensure category_id column exists (migration from legacy text column)
-- ============================================================================
alter table goals add column if not exists category_id bigint;

-- ============================================================================
-- Step 2: Migrate legacy 'category' text column to 'category_id' foreign key
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'goals' and column_name = 'category') then
    -- Update goals with category_id based on legacy text column
    update goals g
    set category_id = c.id
    from categories c
    where g.category_id is null
      and c.user_id is null
      and c.name = case g.category
        when 'sono' then 'Sono'
        when 'estudo' then 'Estudo'
        when 'treino' then 'Treino'
        when 'saude' then 'Saúde'
        when 'foco' then 'Foco'
        else 'Outros'
      end;
    
    -- Drop the old column after migration
    alter table goals drop column if exists category;
  end if;
exception when others then null; end $$;

-- ============================================================================
-- Step 3: Set category_id NOT NULL and add foreign key constraint
-- ============================================================================
alter table goals alter column category_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'goals'::regclass and conname = 'goals_category_id_fkey') then
    alter table goals add constraint goals_category_id_fkey 
      foreign key (category_id) references categories(id) on delete restrict;
  end if;
exception when others then null; end $$;

-- ============================================================================
-- Step 4: Add unit column if not exists (text, max 24 chars)
-- ============================================================================
alter table goals add column if not exists unit text;

-- ============================================================================
-- Step 5: Add deadline column if not exists
-- ============================================================================
alter table goals add column if not exists deadline date;

-- ============================================================================
-- Step 6: Add completed_at column if not exists
-- ============================================================================
alter table goals add column if not exists completed_at timestamptz;

-- ============================================================================
-- Step 7: Set frequency default to 'unique'
-- ============================================================================
alter table goals alter column frequency set default 'unique';

-- ============================================================================
-- Step 8: Normalize any existing invalid frequency values
-- ============================================================================
update goals
set frequency = 
  case 
    when frequency in ('daily', 'weekly', 'monthly', 'unique') then frequency
    when frequency in ('Única', 'unica') then 'unique'
    when frequency in ('Mensal', 'mensal') then 'monthly'
    when frequency in ('Diária', 'diaria', 'diario', 'Diario') then 'daily'
    when frequency in ('Semanal', 'semanal') then 'weekly'
    else 'unique'  -- Default fallback for unknown values
  end
where frequency not in ('daily', 'weekly', 'monthly', 'unique');

-- ============================================================================
-- Step 9: Drop old constraint if it exists (with any values)
-- ============================================================================
do $$
declare
  constraint_name text;
begin
  for constraint_name in 
    select conname from pg_constraint 
    where conrelid = 'goals'::regclass 
      and contype = 'c' 
      and conname like '%frequency%'
  loop
    execute 'alter table goals drop constraint ' || constraint_name;
  end loop;
exception when others then null; end $$;

-- ============================================================================
-- Step 10: Add the correct goals_frequency_check constraint
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'goals'::regclass and conname = 'goals_frequency_check') then
    alter table goals add constraint goals_frequency_check 
      check (frequency in ('daily','weekly','monthly','unique')) not valid;
  end if;
exception when others then null; end $$;

-- ============================================================================
-- Step 11: Validate the constraint (may fail if there are still invalid values)
-- ============================================================================
do $$
begin
  alter table goals validate constraint goals_frequency_check;
exception when check_violation then 
  raise notice 'Some rows have invalid frequency values - constraint is NOT VALID for existing data';
end $$;

-- ============================================================================
-- Step 12: Create indexes for query performance
-- ============================================================================
create index if not exists goals_profile_deadline_idx on goals(profile_id, deadline);
create index if not exists goals_category_id_idx on goals(category_id);

-- ============================================================================
-- Step 13: Ensure goal_logs table exists with proper schema
-- ============================================================================
create table if not exists goal_logs (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  goal_id bigint not null references goals(id) on delete cascade,
  log_date date not null,
  amount numeric(8,2) not null default 1 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (goal_id, log_date)
);
create index if not exists goal_logs_profile_date_idx on goal_logs(profile_id, log_date);