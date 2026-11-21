-- Garden entries now record the aura that was equipped when the session
-- started, and track "completed"/"gave_up" statuses so dead trees show up
-- in the garden ("Meu jardim").

-- aura_id: backfilled from energy_type (the aura used at session start).
alter table garden_entries add column if not exists aura_id text not null default '';
update garden_entries set aura_id = energy_type where aura_id = '';

-- Status values: "completed" (was "alive" — a finished tree) and "gave_up"
-- (a tree that died because the user gave up). The constraint is extended
-- before the backfill because "completed" is not valid on the old check.
do $$ begin
  alter table garden_entries drop constraint if exists garden_entries_status_check;
  alter table garden_entries
    add constraint garden_entries_status_check
    check (status in ('growing', 'completed', 'alive', 'withered', 'gave_up'));
  update garden_entries set status = 'completed' where status = 'alive';
exception when duplicate_object then null; end $$;

create index if not exists garden_entries_profile_status_idx
  on garden_entries(profile_id, status)
  where status in ('completed', 'gave_up');
