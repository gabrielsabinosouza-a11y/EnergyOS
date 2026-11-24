-- ============================================================================
-- reverse-top1-global-bonuses.sql — PREPARED, NOT EXECUTED.
-- Approval required before running: audit this script and the
-- docs/ONBOARDING_19_PROFILES.md / CLEANUP_TOP1_GLOBAL_REPORT.md reports.
-- ============================================================================
--
-- Target: coin_transactions rows with reward_kind = 'top1_global_unlock'
-- that are NOT backed by a qualifying LEGENDS win on the same week
-- (same rule used by league-reset.ts / cleanup-top1-global.sql):
--
--   tier = 'LEGENDS' AND weekly_xp > 0 AND rank = 1
--
-- Debit: reduce user_settings.coins by the total of the reversed
-- transactions (never below 0).
--
-- Idempotency:
--   - runs inside begin/commit,
--   - records each reversal in coin_reversal_log (tx_id is UNIQUE),
--   - insert is guarded by `where not exists (select 1 from coin_reversal_log l where l.tx_id = rt.tx_id)`,
--   - the coins UPDATE subtracts only what is already in the log-free remainder
--     (guard: subtract only when the remaining amount is positive).
--
-- Preserves:
--   - coin_transactions rows are NEVER deleted or modified.
-- ============================================================================

-- 0. Create the reversal log table once if it does not exist yet.
create table if not exists coin_reversal_log (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  tx_id bigint not null,
  amount integer not null check (amount > 0),
  reason text not null default 'reverted: top1_global_unlock without qualifying LEGENDS win',
  reversed_at timestamptz not null default now()
);
create unique index if not exists coin_reversal_log_tx_idx on coin_reversal_log(tx_id);

begin;

-- 1) Audit: show the affected transactions first.
select ct.id as tx_id, ct.profile_id, p.display_name, ct.amount,
       ct.week_start_date, ct.created_at
from coin_transactions ct
left join profiles p on p.id = ct.profile_id
where ct.reward_kind = 'top1_global_unlock'
  and not exists (
    select 1
    from league_weekly_results r
    where r.profile_id = ct.profile_id
      and r.week_start_date = ct.week_start_date
      and r.tier = 'LEGENDS' and r.weekly_xp > 0 and r.rank = 1
  )
order by ct.created_at desc;

-- 2) Preview: per-profile totals that would be reversed.
create temp table reversal_targets on commit drop as
select rt.profile_id, sum(rt.amount) as total_amount, count(*) as tx_count
from (
  select ct.id as tx_id, ct.profile_id, ct.amount
  from coin_transactions ct
  where ct.reward_kind = 'top1_global_unlock'
    and not exists (
      select 1
      from league_weekly_results r
      where r.profile_id = ct.profile_id
        and r.week_start_date = ct.week_start_date
        and r.tier = 'LEGENDS' and r.weekly_xp > 0 and r.rank = 1
    )
) rt
group by rt.profile_id;

select count(*) as profiles_to_reverse, sum(total_amount) as total_coins
from reversal_targets;

-- 3) Debit user_settings.coins for each profile — guarded (never negative,
--    idempotent through coin_reversal_log).
insert into coin_reversal_log (profile_id, tx_id, amount, reason)
select rt2.profile_id, rt2.tx_id, rt2.amount,
       'reverted: top1_global_unlock without qualifying LEGENDS win'
from (
  select ct.id as tx_id, ct.profile_id, ct.amount
  from coin_transactions ct
  where ct.reward_kind = 'top1_global_unlock'
    and not exists (
      select 1
      from league_weekly_results r
      where r.profile_id = ct.profile_id
        and r.week_start_date = ct.week_start_date
        and r.tier = 'LEGENDS' and r.weekly_xp > 0 and r.rank = 1
    )
) rt2
where not exists (select 1 from coin_reversal_log l where l.tx_id = rt2.tx_id)
returning id, profile_id, tx_id, amount;

update user_settings us
set coins = greatest(us.coins - rt.total_amount, 0)
from (
  select rt2.profile_id, sum(rt2.amount) as total_amount
  from (
    select ct.id as tx_id, ct.profile_id, ct.amount
    from coin_transactions ct
    where ct.reward_kind = 'top1_global_unlock'
      and not exists (
        select 1
        from league_weekly_results r
        where r.profile_id = ct.profile_id
          and r.week_start_date = ct.week_start_date
          and r.tier = 'LEGENDS' and r.weekly_xp > 0 and r.rank = 1
      )
  ) rt2
  where not exists (select 1 from coin_reversal_log l where l.tx_id = rt2.tx_id)
  group by rt2.profile_id
) rt
where us.profile_id = rt.profile_id
  and us.coins >= rt.total_amount;

-- 4) Verify: nothing left to reverse (run again — should return 0/0).
select count(*) as remaining_targets from (
  select ct.id as tx_id
  from coin_transactions ct
  where ct.reward_kind = 'top1_global_unlock'
    and not exists (
      select 1
      from league_weekly_results r
      where r.profile_id = ct.profile_id
        and r.week_start_date = ct.week_start_date
        and r.tier = 'LEGENDS' and r.weekly_xp > 0 and r.rank = 1
    )
    and not exists (select 1 from coin_reversal_log l where l.tx_id = ct.id)
) t;

commit;

-- Review the output of the steps 1-3 above before approving. This script is
-- a design artifact only — it has NOT been run against production.
