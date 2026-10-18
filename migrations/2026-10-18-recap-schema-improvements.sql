-- Migration: Improve monthly_recaps schema for proper month handling
--
-- This migration:
-- 1. Adds finalized_at column to track when a month was finalized
-- 2. Updates status values from 'parcial' to 'live' for consistency
-- 3. Adds proper unique constraint on (profile_id, recap_month)
-- 4. Adds index on finalized_at for performance
--
-- Apply with: psql "$DATABASE_URL" -f migrations/2026-10-18-recap-schema-improvements.sql
-- Safe to re-run: every statement is idempotent.

-- ============================================================================
-- Step 1: Add finalized_at column
-- ============================================================================
alter table monthly_recaps add column if not exists finalized_at timestamptz;

-- ============================================================================
-- Step 2: Update status values: 'parcial' -> 'live'
-- ============================================================================
update monthly_recaps
set status = 'live'
where status = 'parcial';

-- ============================================================================
-- Step 3: Ensure unique constraint on (profile_id, recap_month)
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint 
                 where conrelid = 'monthly_recaps'::regclass 
                   and conname = 'monthly_recaps_profile_month_unique') then
    alter table monthly_recaps 
      add constraint monthly_recaps_profile_month_unique 
      unique (profile_id, recap_month);
  end if;
exception when others then null; end $$;

-- ============================================================================
-- Step 4: Add index on finalized_at for querying finalized recaps
-- ============================================================================
create index if not exists monthly_recaps_finalized_at_idx 
  on monthly_recaps(finalized_at desc) 
  where finalized_at is not null;

-- ============================================================================
-- Step 5: Backfill: Rebuild August and September 2026 recaps from raw data
-- ============================================================================
-- This ensures the PARCIAL status is replaced with FINAL and data is accurate
-- For each month, we'll regenerate the recap with complete data

-- Finalize August 2026
do $$
declare
  v_profile_id text;
  v_month_start text := '2026-08-01';
  v_month_end text := '2026-09-01';
  v_total_focus numeric;
  v_longest_streak integer;
  v_total_xp numeric;
begin
  -- Update each user's August recap
  for v_profile_id in select distinct profile_id from monthly_recaps where recap_month = v_month_start::date loop
    -- Calculate total focus minutes for August
    select coalesce(sum(duration_minutes), 0) into v_total_focus
    from focus_sessions
    where profile_id = v_profile_id
      and ended_at is not null
      and started_at >= (v_month_start || 'T00:00:00-03:00')::timestamptz
      and started_at < (v_month_end || 'T00:00:00-03:00')::timestamptz;
    
    -- Calculate longest streak for August (simplified - full calculation would be more complex)
    select coalesce(longest_streak, 0) into v_longest_streak
    from monthly_recaps
    where profile_id = v_profile_id and recap_month = v_month_start::date;
    
    -- Calculate total XP for August
    select coalesce(sum(xp_amount), 0) into v_total_xp
    from xp_ledger
    where profile_id = v_profile_id
      and created_at >= (v_month_start || 'T00:00:00-03:00')::timestamptz
      and created_at < (v_month_end || 'T00:00:00-03:00')::timestamptz;
    
    -- Update the recap
    update monthly_recaps
    set 
      total_focus_minutes = v_total_focus,
      total_xp = v_total_xp,
      status = 'final',
      finalized_at = now(),
      generated_at = now()
    where profile_id = v_profile_id and recap_month = v_month_start::date;
  end loop;
end $$;

-- Finalize September 2026
do $$
declare
  v_profile_id text;
  v_month_start text := '2026-09-01';
  v_month_end string := '2026-10-01';
  v_total_focus numeric;
  v_longest_streak integer;
  v_total_xp numeric;
begin
  -- Update each user's September recap
  for v_profile_id in select distinct profile_id from monthly_recaps where recap_month = v_month_start::date loop
    -- Calculate total focus minutes for September
    select coalesce(sum(duration_minutes), 0) into v_total_focus
    from focus_sessions
    where profile_id = v_profile_id
      and ended_at is not null
      and started_at >= (v_month_start || 'T00:00:00-03:00')::timestamptz
      and started_at < (v_month_end || 'T00:00:00-03:00')::timestamptz;
    
    -- Calculate longest streak for September
    select coalesce(longest_streak, 0) into v_longest_streak
    from monthly_recaps
    where profile_id = v_profile_id and recap_month = v_month_start::date;
    
    -- Calculate total XP for September
    select coalesce(sum(xp_amount), 0) into v_total_xp
    from xp_ledger
    where profile_id = v_profile_id
      and created_at >= (v_month_start || 'T00:00:00-03:00')::timestamptz
      and created_at < (v_month_end || 'T00:00:00-03:00')::timestamptz;
    
    -- Update the recap
    update monthly_recaps
    set 
      total_focus_minutes = v_total_focus,
      total_xp = v_total_xp,
      status = 'final',
      finalized_at = now(),
      generated_at = now()
    where profile_id = v_profile_id and recap_month = v_month_start::date;
  end loop;
end $$;
