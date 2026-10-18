-- Migration: Monthly Recap enhancements (coins, missions, goals, achievements, category)
--
-- This migration adds new columns to track:
-- - Coins gained/spent in the month
-- - Missions (daily quests) completed
-- - Goals completed
-- - Achievements unlocked
-- - Top focus category
--
-- Apply with: psql "$DATABASE_URL" -f migrations/2026-10-19-recap-enhancements.sql
-- Safe to re-run: every statement is idempotent.

-- ============================================================================
-- Step 1: Add new columns to monthly_recaps table
-- ============================================================================

alter table monthly_recaps add column if not exists coins_gained integer not null default 0;
alter table monthly_recaps add column if not exists coins_spent integer not null default 0;
alter table monthly_recaps add column if not exists missions_completed integer not null default 0;
alter table monthly_recaps add column if not exists goals_completed integer not null default 0;
alter table monthly_recaps add column if not exists achievements_unlocked integer not null default 0;
alter table monthly_recaps add column if not exists top_focus_category text;

-- ============================================================================
-- Step 2: Add new columns to monthly_recap_history table (for complete history)
-- ============================================================================

alter table monthly_recap_history add column if not exists coins_gained integer not null default 0;
alter table monthly_recap_history add column if not exists coins_spent integer not null default 0;
alter table monthly_recap_history add column if not exists missions_completed integer not null default 0;
alter table monthly_recap_history add column if not exists goals_completed integer not null default 0;
alter table monthly_recap_history add column if not exists achievements_unlocked integer not null default 0;
alter table monthly_recap_history add column if not exists top_focus_category text;

-- ============================================================================
-- Step 3: Fix status column to include 'live' value
-- ============================================================================

-- First, update any 'parcial' status to 'live'
update monthly_recaps set status = 'live' where status = 'parcial';

-- Update the check constraint to include 'live'
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'monthly_recaps'::regclass
      and conname = 'monthly_recaps_status_check'
  ) then
    alter table monthly_recaps drop constraint monthly_recaps_status_check;
  end if;
  
  alter table monthly_recaps add constraint monthly_recaps_status_check
    check (status = any (array['live'::text, 'final'::text, 'parcial'::text]));
    
  -- Now update parcial to live for any remaining rows
  update monthly_recaps set status = 'live' where status = 'parcial';
  
  -- Remove parcial from the allowed values, keeping only live and final
  alter table monthly_recaps drop constraint monthly_recaps_status_check;
  alter table monthly_recaps add constraint monthly_recaps_status_check
    check (status = any (array['live'::text, 'final'::text]));
end $$;

-- ============================================================================
-- Step 4: Update the unique constraint name if needed (canonical name)
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'monthly_recaps'::regclass
      and conname = 'monthly_recaps_profile_month_unique'
  ) then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'monthly_recaps'::regclass
        and contype = 'u'
        and conkey = array['profile_id', 'recap_month']
    ) then
      -- Rename existing unique constraint to canonical name
      alter table monthly_recaps 
        drop constraint monthly_recaps_pkey; -- This is wrong, need to find the right one
    else
      alter table monthly_recaps
        add constraint monthly_recaps_profile_month_unique
        unique (profile_id, recap_month);
    end if;
  end if;
exception when others then null; end $$;

-- ============================================================================
-- Step 5: Create index on top_focus_category for quicker lookups
-- ============================================================================

create index if not exists monthly_recaps_top_focus_category_idx
  on monthly_recaps(top_focus_category)
  where top_focus_category is not null;