-- Idempotent migration for the shared focus-room timer.
-- Apply with: psql "$DATABASE_URL" -f migrations/2026-10-14-focus-room-timer.sql

do $$ begin
  alter type room_status add value if not exists 'paused';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type room_status add value if not exists 'restarting';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type room_status add value if not exists 'confirming';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type room_status add value if not exists 'expired';
exception when duplicate_object then null; end $$;

do $$ begin
  alter table focus_rooms add column if not exists ends_at timestamptz;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table focus_rooms add column if not exists paused_at timestamptz;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table focus_rooms add column if not exists remaining_seconds integer not null default 0;
exception when duplicate_column then null; end $$;
