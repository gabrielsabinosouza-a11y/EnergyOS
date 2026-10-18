-- Migration: Remove monthly frequency from goals
--
-- This migration:
-- 1. Migrates all "monthly" goals to "unique" (one-time)
-- 2. Updates the frequency check constraint to only allow "unique"
-- 3. Sets the default frequency to "unique"
--
-- Goals are now always one-time: you achieve them once (e.g. "become a Navy SEAL")
-- and they do not reset monthly.
--
-- Apply with: psql "$DATABASE_URL" -f migrations/2026-10-18-goals-remove-monthly.sql
-- Safe to re-run: every statement is idempotent.

-- ============================================================================
-- Step 1: Migrate all monthly goals to unique
-- ============================================================================
update goals
set frequency = 'unique'
where frequency = 'monthly';

-- ============================================================================
-- Step 2: Drop old frequency constraint
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
-- Step 3: Add new constraint allowing only "unique"
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'goals'::regclass and conname = 'goals_frequency_check') then
    alter table goals add constraint goals_frequency_check 
      check (frequency = 'unique') not valid;
  end if;
exception when others then null; end $$;

-- ============================================================================
-- Step 4: Validate the constraint
-- ============================================================================
do $$
begin
  alter table goals validate constraint goals_frequency_check;
exception when check_violation then 
  raise notice 'Some rows have invalid frequency values - constraint is NOT VALID for existing data';
end $$;

-- ============================================================================
-- Step 5: Set default frequency to "unique"
-- ============================================================================
alter table goals alter column frequency set default 'unique';

-- ============================================================================
-- Step 6: Set frequency to "unique" for any NULL values
-- ============================================================================
update goals
set frequency = 'unique'
where frequency is null;

-- ============================================================================
-- Step 7: Make frequency NOT NULL
-- ============================================================================
alter table goals alter column frequency set not null;
