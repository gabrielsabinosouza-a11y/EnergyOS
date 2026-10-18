begin;

-- Re-map the saved positional tiers once; missing reward rows are minted by
-- awardAchievementRewards on the next achievement read, guarded by its unique ledger.
create table if not exists streak_achievement_tier_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from streak_achievement_tier_migrations
    where migration_key = 'streak-master-tiers-7-14-30-100'
  ) then
    return;
  end if;

  with legacy as (
    select
      p.id as profile_id,
      coalesce(u.unlocked_tier, 0) as old_tier,
      u.unlocked_at as old_unlocked_at,
      u.seen_at as old_seen_at,
      coalesce(u.is_featured, false) as is_featured,
      u.featured_order,
      greatest(
        coalesce(p.current_streak, 0),
        coalesce(p.longest_streak, 0),
        coalesce(u.current_value, 0),
        case
          when coalesce(u.unlocked_tier, 0) >= 3 then 100
          when coalesce(u.unlocked_tier, 0) = 2 then 30
          when coalesce(u.unlocked_tier, 0) = 1 then 7
          else 0
        end
      ) as best_streak
    from profiles p
    left join user_achievement_progress u
      on u.profile_id = p.id and u.achievement_id = 'streak_master'
    where u.profile_id is not null
       or coalesce(p.current_streak, 0) > 0
       or coalesce(p.longest_streak, 0) > 0
  ),
  tiered as (
    select *,
      case
        when best_streak >= 100 then 4
        when best_streak >= 30 then 3
        when best_streak >= 14 then 2
        when best_streak >= 7 then 1
        else 0
      end as new_tier
    from legacy
  ),
  reward_dates as (
    select
      profile_id,
      max(awarded_at) filter (where tier = 1) as tier_1_at,
      max(awarded_at) filter (where tier = 2) as tier_2_at,
      max(awarded_at) filter (where tier = 3) as tier_3_at
    from achievement_rewards
    where achievement_id = 'streak_master'
    group by profile_id
  )
  insert into user_achievement_progress
    (profile_id, achievement_id, current_value, unlocked_tier, unlocked_at, seen_at, is_featured, featured_order)
  select
    t.profile_id,
    'streak_master',
    t.best_streak,
    t.new_tier,
    case t.new_tier
      when 0 then null
      when 1 then coalesce(d.tier_1_at, case when t.old_tier >= 1 then t.old_unlocked_at end, now())
      when 2 then now()
      when 3 then coalesce(d.tier_2_at, case when t.old_tier >= 2 then t.old_unlocked_at end, now())
      when 4 then coalesce(d.tier_3_at, case when t.old_tier >= 3 then t.old_unlocked_at end, now())
    end,
    case when t.new_tier > t.old_tier then null else t.old_seen_at end,
    t.is_featured,
    t.featured_order
  from tiered t
  left join reward_dates d on d.profile_id = t.profile_id
  on conflict (profile_id, achievement_id) do update set
    current_value = greatest(user_achievement_progress.current_value, excluded.current_value),
    unlocked_tier = excluded.unlocked_tier,
    unlocked_at = excluded.unlocked_at,
    seen_at = case
      when excluded.unlocked_tier > user_achievement_progress.unlocked_tier then null
      else user_achievement_progress.seen_at
    end;

  insert into streak_achievement_tier_migrations (migration_key)
  values ('streak-master-tiers-7-14-30-100');
end $$;

commit;
