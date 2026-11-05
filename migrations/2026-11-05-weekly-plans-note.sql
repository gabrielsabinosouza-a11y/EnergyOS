-- Add an optional note/description to one-time weekly plans.
-- Recurring series already store notes in weekly_plan_series.note.
-- Run with: psql "$DATABASE_URL" -f migrations/2026-11-05-weekly-plans-note.sql

alter table weekly_plans add column if not exists note text;
