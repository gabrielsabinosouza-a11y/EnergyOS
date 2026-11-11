-- Planejamento: 1 documento por item + conclusões por ocorrência.
-- Idempotent; mirrors src/db-schema.sql and scripts/migrate-terminology.mjs.

create table if not exists planner_items (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  title text not null,
  category_id bigint not null references categories(id),
  kind text not null default 'task' check (kind in ('task','event')),
  date date not null,
  time time,
  all_day boolean not null default true,
  recurrence_type text not null default 'none' check (recurrence_type in ('none','weekly','monthly','yearly')),
  recurrence_weekdays smallint[] not null default '{}',
  recurrence_interval_weeks smallint,
  recurrence_until date,
  skipped_dates date[] not null default '{}',
  migrated_from_plan_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists planner_items_profile_date_idx on planner_items(profile_id, date);
create index if not exists planner_items_migrated_idx on planner_items(migrated_from_plan_id);

create table if not exists planner_completions (
  item_id bigint not null references planner_items(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  completed_date date not null,
  completed_at timestamptz not null default now(),
  doc_id text generated always as (
    item_id::text || '_' ||
    lpad(extract(year from completed_date)::text, 4, '0') || '-' ||
    lpad(extract(month from completed_date)::text, 2, '0') || '-' ||
    lpad(extract(day from completed_date)::text, 2, '0')
  ) stored,
  primary key (item_id, completed_date)
);

create index if not exists planner_completions_profile_date_idx on planner_completions(profile_id, completed_date);
