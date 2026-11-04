-- Timestamp-based focus state and explicit give-up outcomes.
begin;

alter table focus_sessions add column if not exists end_reason text;
alter table focus_sessions add column if not exists focused_seconds integer not null default 0;
alter table focus_sessions add column if not exists paused_at timestamptz;
alter table focus_sessions add column if not exists total_paused_seconds integer not null default 0;

alter table focus_sessions drop constraint if exists focus_sessions_end_reason_check;
alter table focus_sessions add constraint focus_sessions_end_reason_check
  check (end_reason is null or end_reason in ('completed', 'gave_up'));

-- Existing closed sessions retain their historical behavior. Previously
-- abandoned zero-minute sessions already had no reward or progression.
update focus_sessions
   set end_reason = case when duration_minutes = 0 then 'gave_up' else 'completed' end,
       focused_seconds = greatest(0, duration_minutes * 60)
 where ended_at is not null and end_reason is null;

commit;
