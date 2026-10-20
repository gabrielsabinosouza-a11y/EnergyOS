-- Migration for optional task scheduling
-- Allows creating tasks without a date, start time, or end time
-- Run with: psql "$DATABASE_URL" -f migrations/2026-10-21-optional-scheduling.sql

-- Make plan_date nullable for one-time weekly plans
alter table weekly_plans alter column plan_date drop not null;

-- Create index for unscheduled tasks (plan_date is null)
create index if not exists weekly_plans_unscheduled_idx on weekly_plans(profile_id, plan_date) where plan_date is null;

-- For recurring series, make start_date nullable as well (for unscheduled recurring tasks)
-- Note: This is a more complex case - recurring series still need an anchor date for generation
-- We'll keep start_date required for weekly_plan_series
-- If needed, a separate "unscheduled_recurring" approach could be implemented

-- Update the schema file
-- Note: The db-schema.sql file should be updated separately to reflect the nullable plan_date