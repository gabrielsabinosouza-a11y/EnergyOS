-- Fix streak_day_log integrity:
-- 1. Backfill missing 'success' entries from focus_sessions.
-- 2. Correct any 'protected' rows that should be 'success'
--    (days where the user had a focus session but the log was written as protected).
-- 3. Correct any 'lost' rows that should be 'protected'
--    (days in streak_shield_usage that were logged as lost due to write-order bugs).

-- Step 1 & 2: upsert 'success' for every day with a qualifying focus session.
-- The 'success' status wins over any existing status (success > protected > lost).
insert into streak_day_log (profile_id, log_date, status)
select
  fs.profile_id,
  (fs.ended_at at time zone 'America/Sao_Paulo')::date as log_date,
  'success'::streak_day_status
from focus_sessions fs
where fs.ended_at is not null
  and fs.duration_minutes >= 1
group by fs.profile_id, (fs.ended_at at time zone 'America/Sao_Paulo')::date
on conflict (profile_id, log_date)
do update set status = 'success'::streak_day_status;

-- Step 3: upsert 'protected' for every day in streak_shield_usage,
-- but only when the log has no 'success' entry for that day.
insert into streak_day_log (profile_id, log_date, status)
select profile_id, used_on_date, 'protected'::streak_day_status
from streak_shield_usage
on conflict (profile_id, log_date)
do update set status = case
  when streak_day_log.status = 'success'::streak_day_status then 'success'::streak_day_status
  else 'protected'::streak_day_status
end;
