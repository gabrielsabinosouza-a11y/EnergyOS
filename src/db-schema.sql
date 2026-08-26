create table if not exists profiles (
  id text primary key,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists daily_checkins (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  checkin_date date not null,
  sleep_hours numeric(4, 2),
  study_minutes integer,
  training_minutes integer,
  energy_score smallint check (energy_score between 1 and 5),
  unique (profile_id, checkin_date)
);

create table if not exists tasks (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  title text not null,
  category text not null,
  due_date date not null,
  completed_at timestamptz
);

create index if not exists daily_checkins_profile_date_idx on daily_checkins(profile_id, checkin_date desc);
create index if not exists tasks_profile_due_date_idx on tasks(profile_id, due_date);

create table if not exists goals (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  title text not null,
  category text not null check (category in ('sono','estudo','treino','saude','foco')),
  target_value numeric(8,2) not null,
  current_value numeric(8,2) not null default 0,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  created_at timestamptz not null default now()
);

create table if not exists habits (
  id bigserial primary key,
  goal_id bigint not null references goals(id) on delete cascade,
  title text not null,
  frequency text not null check (frequency in ('daily','weekly')),
  active boolean not null default true
);

create table if not exists user_settings (
  profile_id text primary key references profiles(id) on delete cascade,
  notifications_enabled boolean not null default true,
  preferred_theme text not null default 'system' check (preferred_theme in ('system','light','dark')),
  sleep_time time,
  focus_time time
);

create index if not exists goals_profile_idx on goals(profile_id);
create index if not exists habits_goal_idx on habits(goal_id);

create table if not exists habit_completions (
  habit_id bigint not null references habits(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  completed_date date not null,
  primary key (habit_id, completed_date)
);

create index if not exists habit_completions_profile_date_idx on habit_completions(profile_id, completed_date);

create table if not exists insights (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  week_start date not null,
  kind text not null check (kind in ('sleep','study','training','energy','tasks')),
  title text not null,
  description text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, week_start, kind)
);

create index if not exists insights_profile_week_idx on insights(profile_id, week_start desc);

create table if not exists kanban_tasks (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  position integer not null default 0,
  category text default 'FOCO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kanban_tasks_profile_idx on kanban_tasks(profile_id, status, position);

create table if not exists weekly_plans (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  plan_date date not null,
  title text not null,
  category text default 'FOCO',
  task_id bigint references tasks(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists weekly_plans_profile_date_idx on weekly_plans(profile_id, plan_date);

create table if not exists focus_sessions (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  duration_minutes integer not null default 0,
  target_duration_minutes integer not null default 25,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  task_id bigint references tasks(id) on delete set null,
  xp_earned integer not null default 0
);

create index if not exists focus_sessions_profile_idx on focus_sessions(profile_id, started_at desc);

create table if not exists xp_ledger (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  source text not null check (source in ('task','kanban','focus','streak_bonus')),
  source_id bigint,
  xp_amount integer not null,
  created_at timestamptz not null default now()
);

create index if not exists xp_ledger_profile_idx on xp_ledger(profile_id, created_at desc);

create table if not exists user_xp (
  profile_id text primary key references profiles(id) on delete cascade,
  total_xp integer not null default 0,
  level integer not null default 1,
  updated_at timestamptz not null default now()
);
