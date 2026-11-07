-- Migration: Add reminder_offset_min to weekly plan series and occurrences
-- Adds the missing reminder_offset_min column to both tables so that
-- convertWeeklyPlanToSeries can write reminder settings when converting
-- one-time plans to recurring series.
--
-- Run with: psql "$DATABASE_URL" -f migrations/2026-11-08-weekly-plan-reminder-offset.sql

ALTER TABLE weekly_plan_series ADD COLUMN IF NOT EXISTS reminder_offset_min int;
ALTER TABLE weekly_plan_occurrences ADD COLUMN IF NOT EXISTS reminder_offset_min int;
