-- Migration: Add status column to focus_sessions for proper session state tracking
-- Allows distinguishing completed, cancelled, abandoned, and gave_up sessions
-- Enables excluding cancelled sessions from recap calculations

do $$ begin
  create type focus_session_status as enum ('completed', 'cancelled', 'abandoned', 'gave_up');
exception when duplicate_object then null; end $$;

alter table focus_sessions add column if not exists status focus_session_status;

-- Backfill existing sessions based on end_reason and ended_at
update focus_sessions
set status = case
  when end_reason = 'gave_up' then 'gave_up'::focus_session_status
  when ended_at is null then 'abandoned'::focus_session_status
  else 'completed'::focus_session_status
end
where status is null;

-- Set default for new rows
alter table focus_sessions alter column status set default 'completed'::focus_session_status;

-- Add constraint to ensure status is set
alter table focus_sessions add constraint focus_sessions_status_not_null check (status is not null) not valid;

-- Create index for recap queries (profile_id, status, ended_at)
create index if not exists focus_sessions_profile_status_ended_idx 
  on focus_sessions(profile_id, status, ended_at desc)
  where ended_at is not null;

-- Create index for finding abandoned sessions
create index if not exists focus_sessions_abandoned_idx
  on focus_sessions(profile_id, started_at)
  where status = 'abandoned' and ended_at is null;
