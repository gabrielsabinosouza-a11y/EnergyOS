-- ============================================================================
-- cleanup-top1-global.sql — REMOVE WRONGLY AWARDED "Top 1 Global" progress
-- ============================================================================
-- DO NOT RUN ON PRODUCTION WITHOUT APPROVAL. Take a backup first:
--   pg_dump "$DATABASE_URL" -t profiles -t user_achievement_progress \
--     -t coin_transactions > backup-top1-$(date +%F).sql
--
-- Bug being cleaned: league-reset awarded Top 1 Global to ANY rank-1 finisher
-- in ANY tier, including 0-XP leaders and solo groups. Correct rule:
--   tier = 'LEGENDS' AND weekly_xp > 0 AND group size > 1 AND
--   weekly_xp = group top score (rank 1 or XP tie).
--
-- This script recalculates times_top_1_global / achievement progress from
-- league_weekly_results. It does NOT touch coin_transactions (see notes).
-- ============================================================================

begin;

-- 1) Legitimate finishes per profile (same rule as the fixed code).
create temp table top1_legit on commit drop as
with grp as (
  select league_group_id, week_start_date, count(*) as size, max(weekly_xp) as top_xp
  from league_weekly_results
  group by 1, 2
)
select r.profile_id,
       count(*)::int as legit_count,
       max(r.week_start_date) as last_legit_week
from league_weekly_results r
join grp g
  on g.league_group_id = r.league_group_id
 and g.week_start_date   = r.week_start_date
where r.tier = 'LEGENDS'
  and r.weekly_xp > 0
  and g.size > 1
  and r.weekly_xp = g.top_xp
group by r.profile_id;

-- 2) Preview: what will change (run this SELECT first to review).
select p.display_name,
       p.times_top_1_global            as stored_count,
       coalesce(t.legit_count, 0)      as legit_count,
       p.last_top_1_global_week        as stored_last_week,
       t.last_legit_week               as legit_last_week
from profiles p
left join top1_legit t on t.profile_id = p.id
where p.times_top_1_global <> coalesce(t.legit_count, 0)
   or (t.last_legit_week is not null
       and p.last_top_1_global_week is distinct from t.last_legit_week)
order by p.display_name;

-- 3) Apply: profiles counters.
update profiles p
set times_top_1_global = coalesce(t.legit_count, 0),
    last_top_1_global_week = t.last_legit_week
from (select profile_id, legit_count, last_legit_week from top1_legit) t
where p.id = t.profile_id
  and (p.times_top_1_global <> t.legit_count
       or p.last_top_1_global_week is distinct from t.last_legit_week);

-- Profiles with zero legit finishes.
update profiles p
set times_top_1_global = 0,
    last_top_1_global_week = null
where p.times_top_1_global > 0
  and not exists (select 1 from top1_legit t where t.profile_id = p.id);

-- 4) Achievement progress: sync current_value; drop rows that were never earned.
update user_achievement_progress uap
set current_value = t.legit_count
from top1_legit t
where uap.achievement_id = 'top_1_global'
  and uap.profile_id = t.profile_id
  and uap.current_value <> t.legit_count;

delete from user_achievement_progress uap
where uap.achievement_id = 'top_1_global'
  and not exists (select 1 from top1_legit t where t.profile_id = uap.profile_id);

commit;

-- ============================================================================
-- NOT included (needs separate approval): coin_transactions rows with
-- reward_kind = 'top1_global_unlock' granted the 1,000-coin first-unlock bonus
-- to users who never legitimately won. Reversing them means debiting coins;
-- review first:
--
--   select ct.profile_id, p.display_name, ct.amount, ct.week_start_date
--   from coin_transactions ct join profiles p on p.id = ct.profile_id
--   where ct.reward_kind = 'top1_global_unlock'
--     and not exists (
--       select 1 from league_weekly_results r
--       where r.profile_id = ct.profile_id
--         and r.week_start_date = ct.week_start_date
--         and r.tier = 'LEGENDS' and r.weekly_xp > 0 and r.rank = 1
--     );
-- ============================================================================
