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
