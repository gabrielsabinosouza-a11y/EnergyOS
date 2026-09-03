create table if not exists profiles (
  id text primary key,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);

-- ── Unified category system (metas + tarefas + Kanban + plano semanal) ──────
-- user_id null = categoria padrão do sistema, disponível para todos.
create table if not exists categories (
  id bigserial primary key,
  user_id text references profiles(id) on delete cascade,
  name text not null,
  color text not null,
  icon text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

-- Nome único por escopo (sistema ou usuário).
create unique index if not exists categories_scope_name_idx
  on categories (coalesce(user_id, ''), lower(name));
create index if not exists categories_user_idx on categories(user_id);

insert into categories (user_id, name, color, icon, is_custom) values
  (null, 'Sono',   '#71d4ff', 'moon',     false),
  (null, 'Estudo', '#b69cff', 'timer',    false),
  (null, 'Treino', '#ffb86b', 'dumbbell', false),
  (null, 'Foco',   '#ff9f6b', 'zap',      false),
  (null, 'Outros', '#94a3b8', null,       false)
on conflict do nothing;

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
  category_id bigint not null references categories(id),
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
  preferred_theme text not null default 'dark' check (preferred_theme in ('system','light','dark')),
  sleep_time time,
  focus_time time,
  coins integer not null default 0,
  sound_notifications_enabled boolean not null default true
);

-- Upgrade existing installs (idempotent; new installs already have the column)
alter table user_settings add column if not exists sound_notifications_enabled boolean not null default true;

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
  category_id bigint not null references categories(id),
  labels text[] default '{}',
  due_date date,
  priority text default 'medium' check (priority in ('low','medium','high')),
  assignee_id text references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kanban_tasks_profile_idx on kanban_tasks(profile_id, status, position);

create table if not exists kanban_labels (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists kanban_labels_profile_idx on kanban_labels(profile_id);

-- Focus Rooms (co-focus with friends)
do $$ begin
  create type room_status as enum ('waiting', 'active', 'paused', 'completed', 'expired');
exception when duplicate_object then null; end $$;
do $$ begin
  alter type room_status add value if not exists 'expired';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type room_status add value if not exists 'paused';
exception when duplicate_object then null; end $$;
do $$ begin
  create type participant_session_status as enum ('waiting', 'focusing', 'completed', 'left');
exception when duplicate_object then null; end $$;

create table if not exists focus_rooms (
  id bigserial primary key,
  code varchar(6) not null unique,
  host_profile_id text not null references profiles(id) on delete cascade,
  status room_status not null default 'waiting',
  duration_minutes integer not null default 25,
  energy_type text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  elapsed_seconds integer not null default 0,
  last_resumed_at timestamptz
);

-- Pause bookkeeping for existing rooms created before the pause feature
do $$ begin
  alter table focus_rooms add column if not exists elapsed_seconds integer not null default 0;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table focus_rooms add column if not exists last_resumed_at timestamptz;
exception when duplicate_column then null; end $$;

create index if not exists focus_rooms_code_idx on focus_rooms(code);
create index if not exists focus_rooms_host_idx on focus_rooms(host_profile_id);
create index if not exists focus_rooms_status_idx on focus_rooms(status);

create table if not exists room_participants (
  id bigserial primary key,
  room_id bigint not null references focus_rooms(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  session_status participant_session_status not null default 'waiting',
  selected_energy_type text,
  completed_at timestamptz,
  gave_up_at timestamptz,
  unique (room_id, profile_id)
);

create index if not exists room_participants_room_idx on room_participants(room_id);
create index if not exists room_participants_profile_idx on room_participants(profile_id);

-- League System
do $$ begin
  create type league_tier as enum ('BRONZE', 'PRATA', 'OURO', 'DIAMANTE', 'LENDAS');
exception when duplicate_object then null; end $$;

create table if not exists league_groups (
  id bigserial primary key,
  tier league_tier not null,
  week_start_date date not null,
  week_end_date date not null,
  is_legends_group boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tier, week_start_date)
);

create index if not exists league_groups_tier_week_idx on league_groups(tier, week_start_date);
create index if not exists league_groups_is_legends_idx on league_groups(is_legends_group);

create table if not exists league_group_members (
  id bigserial primary key,
  league_group_id bigint not null references league_groups(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  weekly_xp integer not null default 0,
  rank integer,
  joined_at timestamptz not null default now(),
  unique (league_group_id, profile_id)
);

create index if not exists league_group_members_group_idx on league_group_members(league_group_id);
create index if not exists league_group_members_profile_idx on league_group_members(profile_id);
create index if not exists league_group_members_week_idx on league_group_members(league_group_id, weekly_xp desc);

create table if not exists weekly_plans (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  plan_date date not null,
  title text not null,
  category_id bigint not null references categories(id),
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

alter table focus_sessions add column if not exists energy_type text;

create index if not exists focus_sessions_profile_idx on focus_sessions(profile_id, started_at desc);

-- ── Garden (Meu Jardim) ─────────────────────────────────────────────────────
-- Each row is one "planted energy" earned by a completed focus session. A single
-- session plants `reward` rows (the reward-tier multiplier: 10-50min → 1,
-- 60-80min → 2, 90+min → 4). Focus minutes are split evenly across the plants so
-- that the SUM of duration_minutes equals the session's real focused minutes.
create table if not exists garden_entries (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  session_id bigint references focus_sessions(id) on delete cascade,
  energy_type text not null,
  duration_minutes numeric(8,2) not null default 0,
  reward integer not null default 1,
  planted_at timestamptz not null default now(),
  legacy_key text
);

create unique index if not exists garden_entries_legacy_key_idx on garden_entries(profile_id, legacy_key) where legacy_key is not null;

create index if not exists garden_entries_profile_planted_idx on garden_entries(profile_id, planted_at desc);

delete from garden_entries where energy_type in ('nature','solar');

create table if not exists xp_ledger (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  source text not null check (source in ('task','kanban','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement')),
  source_id bigint,
  xp_amount integer not null,
  created_at timestamptz not null default now()
);

create index if not exists xp_ledger_profile_idx on xp_ledger(profile_id, created_at desc);

-- ── XP ledger hardening ───────────────────────────────────────────────────────
-- source_id stores heterogeneous identifiers (task ids, kanban ids, dates, etc.)
-- so it must be text; bigint crashed on string ids such as "checkin_streak" dates.
alter table xp_ledger alter column source_id type text using source_id::text;
-- 'kanban_task' is written by awardKanbanXP; keep legacy 'kanban' allowed too.
alter table xp_ledger drop constraint if exists xp_ledger_source_check;
alter table xp_ledger add constraint xp_ledger_source_check
  check (source in ('task','kanban','kanban_task','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal','achievement'));
-- Idempotency backstop: one ledger row per (profile, source, source_id).
create unique index if not exists xp_ledger_dedupe_idx
  on xp_ledger(profile_id, source, coalesce(source_id, ''));

create table if not exists user_xp (
  profile_id text primary key references profiles(id) on delete cascade,
  total_xp integer not null default 0,
  level integer not null default 1,
  updated_at timestamptz not null default now()
);

-- ── Social: profile extras ──────────────────────────────────────────────────
alter table profiles add column if not exists username text;
alter table profiles add column if not exists photo_url text;
alter table profiles add column if not exists last_active_at timestamptz;
alter table profiles add column if not exists current_streak integer not null default 0;
alter table profiles add column if not exists longest_streak integer not null default 0;
alter table profiles add column if not exists role text not null default 'user' check (role in ('user', 'admin'));
alter table profiles add column if not exists highest_league_tier league_tier;

create unique index if not exists profiles_username_lower_idx
  on profiles (lower(username)) where username is not null;

alter table daily_checkins add column if not exists created_at timestamptz not null default now();

-- ── Friendships ─────────────────────────────────────────────────────────────
create table if not exists friendships (
  id bigserial primary key,
  requester_id text not null references profiles(id) on delete cascade,
  addressee_id text not null references profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_requester_idx on friendships(requester_id, status);
create index if not exists friendships_addressee_idx on friendships(addressee_id, status);

-- ── Groups ──────────────────────────────────────────────────────────────────
create table if not exists groups (
  id bigserial primary key,
  name text not null,
  avatar_emoji text not null default '⚡',
  avatar_url text,
  created_by text not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  description text,
  is_public boolean not null default false
);

-- Add missing columns if they don't exist (for existing databases)
do $$ begin
  alter table groups add column if not exists description text;
  alter table groups add column if not exists is_public boolean not null default false;
exception when duplicate_column then null; end $$;

create table if not exists group_members (
  group_id bigint not null references groups(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'ADMIN', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
alter table group_members add column if not exists is_muted boolean not null default false;

-- Migrate existing groups role data (lowercase old values -> uppercase new set),
-- and swap the single-column check constraint. Drop the old constraint first so
-- legacy lowercase rows can be uppercased before the new check is applied.
do $$ begin
  alter table group_members drop constraint if exists group_members_role_check;
exception when others then null; end $$;

do $$ begin
  alter table group_members alter column role drop default;
exception when others then null; end $$;

do $$ begin
  update group_members set role = 'OWNER'  where role = 'owner';
  update group_members set role = 'MEMBER' where role = 'member';
  update group_members set role = 'ADMIN'  where role = 'admin';
exception when others then null; end $$;

do $$ begin
  alter table group_members add constraint group_members_role_check
    check (role in ('OWNER', 'ADMIN', 'MEMBER'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table group_members alter column role set default 'MEMBER';
exception when others then null; end $$;

create index if not exists group_members_profile_idx on group_members(profile_id);

-- ── Group Focus Contributions ───────────────────────────────────────────────
-- Tracks focus session contributions to groups for leaderboard calculations
create table if not exists group_focus_contributions (
  id bigserial primary key,
  group_id bigint not null references groups(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  focus_session_id bigint not null references focus_sessions(id) on delete cascade,
  minutes integer not null,
  contributed_at timestamptz not null default now(),
  unique (group_id, profile_id, focus_session_id)
);

create index if not exists group_focus_contributions_group_idx on group_focus_contributions(group_id, contributed_at desc);
create index if not exists group_focus_contributions_profile_idx on group_focus_contributions(profile_id, contributed_at desc);
create index if not exists group_focus_contributions_session_idx on group_focus_contributions(focus_session_id);

create table if not exists group_messages (
  id bigserial primary key,
  group_id bigint not null references groups(id) on delete cascade,
  sender_id text not null references profiles(id) on delete cascade,
  body text,
  message_type text not null default 'TEXT'
    check (message_type in ('TEXT', 'IMAGE', 'VIDEO', 'STICKER', 'AUDIO')),
  media_url text,
  media_duration_seconds integer,
  created_at timestamptz not null default now(),
  reply_to_id bigint,
  edited_at timestamptz
);

-- Add media columns to existing group_messages tables (idempotent for old dbs)
do $$ begin
  alter table group_messages add column if not exists message_type text not null default 'TEXT';
  alter table group_messages add column if not exists media_url text;
  alter table group_messages add column if not exists media_duration_seconds integer;
  alter table group_messages add column if not exists reply_to_id bigint;
  alter table group_messages add column if not exists edited_at timestamptz;
  -- Media-only messages (image/video/audio) have no text body, so body must be nullable
  alter table group_messages alter column body drop not null;
exception when others then null; end $$;

create index if not exists group_messages_group_idx on group_messages(group_id, created_at desc);
create index if not exists group_messages_reply_idx on group_messages(reply_to_id);

create table if not exists group_reads (
  profile_id text not null references profiles(id) on delete cascade,
  group_id bigint not null references groups(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (profile_id, group_id)
);

-- ── Group focus contributions backfill ────────────────────────────────────
-- Existing groups may have members who completed focus sessions (reaching
-- their target duration) before joining a group, so those sessions were never
-- recorded as contributions. Backfill those completed sessions idempotently so
-- every group leaderboard reflects its members' real historical focus.
insert into group_focus_contributions (group_id, profile_id, focus_session_id, minutes, contributed_at)
select gm.group_id, fs.profile_id, fs.id, fs.duration_minutes, fs.ended_at
from group_members gm
join focus_sessions fs
  on fs.profile_id = gm.profile_id
 and fs.ended_at is not null
 and fs.duration_minutes >= coalesce(fs.target_duration_minutes, 0)
where gm.role in ('OWNER', 'ADMIN', 'MEMBER')
on conflict (group_id, profile_id, focus_session_id) do nothing;

-- ── Direct messages ─────────────────────────────────────────────────────────
create table if not exists direct_messages (
  id bigserial primary key,
  sender_id text not null references profiles(id) on delete cascade,
  recipient_id text not null references profiles(id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  reply_to_id bigint,
  edited_at timestamptz,
  check (sender_id <> recipient_id)
);

-- Allow media-only direct messages (body null)
do $$ begin
  alter table direct_messages alter column body drop not null;
exception when others then null; end $$;

-- Reply + edit columns (idempotent for existing DBs)
do $$ begin
  alter table direct_messages add column if not exists reply_to_id bigint;
  alter table direct_messages add column if not exists edited_at timestamptz;
exception when others then null; end $$;

create index if not exists dm_pair_idx on direct_messages (
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id),
  created_at desc
);
create index if not exists dm_recipient_idx on direct_messages(recipient_id, created_at desc);
create index if not exists dm_reply_idx on direct_messages(reply_to_id);

create table if not exists dm_reads (
  profile_id text not null references profiles(id) on delete cascade,
  other_id text not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (profile_id, other_id)
);

-- ── Weekly league ───────────────────────────────────────────────────────────
create table if not exists league_standings (
  profile_id text primary key references profiles(id) on delete cascade,
  current_tier text not null default 'faisca' check (current_tier in ('faisca', 'chama', 'aura', 'nucleo')),
  last_week_rank integer,
  last_week_result text check (last_week_result in ('promoted', 'demoted', 'stayed'))
);

create table if not exists league_entries (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  week_start date not null,
  tier text not null check (tier in ('faisca', 'chama', 'aura', 'nucleo')),
  xp integer not null default 0,
  rank integer,
  unique (profile_id, week_start)
);

create index if not exists league_entries_week_tier_idx on league_entries(week_start, tier, xp desc);

-- ── Achievements ────────────────────────────────────────────────────────────
create table if not exists achievements (
  id text primary key,
  title text not null,
  description text not null,
  category text not null
);

create table if not exists user_achievement_progress (
  profile_id text not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  current_value integer not null default 0,
  unlocked_tier integer not null default 0,
  seen_at timestamptz,
  unlocked_at timestamptz,
  is_featured boolean not null default false,
  featured_order integer,
  primary key (profile_id, achievement_id)
);

insert into achievements (id, title, description, category) values
  ('streak_master',    'Streak Master',  'Mantenha sequências de consistência',           'streak'),
  ('deep_focus',       'Deep Focus',     'Complete sessões longas de foco',               'focus'),
  ('early_riser',      'Early Riser',    'Faça check-in antes das 7h',                    'checkin'),
  ('sleep_champion',   'Sleep Champion', 'Durma 7 horas ou mais',                         'sleep'),
  ('consistency_king', 'Consistency King','Semanas perfeitas de check-in',                'checkin'),
  ('xp_olympian',      'XP Olympian',    'Acumule minutos de foco ao longo da vida',      'focus'),
  ('social_spark',     'Social Spark',   'Faça amigos e entre em grupos',                 'social'),
  ('rarest_aura',      'Top 1 Global',   'Termine no topo da Liga Lendários',                'league')
on conflict (id) do nothing;

-- Idempotency ledger for achievement rewards. Each (profile, achievement, tier)
-- row is minted exactly once, so coins + XP are never granted twice even if
-- progress is recomputed repeatedly.
create table if not exists achievement_rewards (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  tier integer not null,
  coins_awarded integer not null default 0,
  xp_awarded integer not null default 0,
  awarded_at timestamptz not null default now(),
  unique (profile_id, achievement_id, tier)
);
create index if not exists achievement_rewards_profile_idx
  on achievement_rewards(profile_id);

-- ========================================
-- Daily Quests System
-- ========================================

do $$ begin
  create type quest_type as enum ('SESSIONS_COUNT', 'TOTAL_MINUTES', 'ROOM_SESSION');
exception when duplicate_object then null; end $$;

create table if not exists daily_quests (
  id bigserial primary key,
  title text not null unique,
  description text not null,
  type quest_type,
  metric text,
  target_value integer not null,
  coin_reward integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists daily_quests_metric_idx on daily_quests(metric);
create index if not exists daily_quests_active_idx on daily_quests(is_active);

create table if not exists user_quest_progress (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  quest_id bigint not null references daily_quests(id) on delete cascade,
  quest_date date not null,
  current_value integer not null default 0,
  is_completed boolean not null default false,
  is_claimed boolean not null default false,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, quest_id, quest_date)
);

create index if not exists user_quest_progress_profile_date_idx on user_quest_progress(profile_id, quest_date);
create index if not exists user_quest_progress_quest_date_idx on user_quest_progress(quest_id, quest_date);

-- Idempotency ledger for daily mission rewards. A mission can be awarded only
-- once for a user and product day, even if the request is replayed.
create table if not exists daily_mission_claims (
  id bigserial primary key,
  user_id text not null references profiles(id) on delete cascade,
  mission_id bigint not null references daily_quests(id) on delete cascade,
  date date not null,
  claimed_at timestamptz not null default now(),
  unique (user_id, mission_id, date)
);

create index if not exists daily_mission_claims_user_date_idx
  on daily_mission_claims(user_id, date);

-- Mission pool (each user is randomly assigned exactly 3 active missions per day).
-- `metric` is the machine-readable event used to drive progress; `type` is kept
-- for backward compatibility with the legacy daily-quests UI/claiming flow.
insert into daily_quests (title, description, metric, type, target_value, coin_reward) values
  ('Complete 1 sessão de foco', 'Conclua 1 sessão de foco hoje', 'SESSIONS_COMPLETED', 'SESSIONS_COUNT', 1, 10),
  ('Complete 2 sessões de foco', 'Conclua 2 sessões de foco hoje', 'SESSIONS_COMPLETED', 'SESSIONS_COUNT', 2, 10),
  ('Complete 3 sessões de foco', 'Conclua 3 sessões de foco hoje', 'SESSIONS_COMPLETED', 'SESSIONS_COUNT', 3, 15),
  ('Foque 30 minutos hoje', 'Acumule 30 minutos de foco hoje', 'TOTAL_MINUTES', 'TOTAL_MINUTES', 30, 10),
  ('Foque 60 minutos hoje', 'Acumule 60 minutos de foco hoje', 'TOTAL_MINUTES', 'TOTAL_MINUTES', 60, 10),
  ('Foque 90 minutos hoje', 'Acumule 90 minutos de foco hoje', 'TOTAL_MINUTES', 'TOTAL_MINUTES', 90, 15),
  ('Participe de uma Sala de Foco', 'Participe de uma sessão em uma Sala de Foco', 'ROOM_SESSION_COMPLETED', 'ROOM_SESSION', 1, 20),
  ('Participe de 2 salas diferentes', 'Participe de sessões em 2 salas de foco diferentes', 'DISTINCT_ROOMS', 'ROOM_SESSION', 2, 15),
  ('Complete 3 tarefas hoje', 'Conclua 3 tarefas hoje', 'TASKS_COMPLETED', 'SESSIONS_COUNT', 3, 10),
  ('Mantenha seu streak por mais um dia', 'Atinja a qualificação diária de streak hoje', 'STREAK_DAY', 'SESSIONS_COUNT', 1, 15),
  ('Complete uma sessão de 60+ minutos', 'Conclua uma única sessão de foco com 60 minutos ou mais', 'LONG_SESSION_60', 'SESSIONS_COUNT', 1, 20),
  ('Complete 3 hábitos hoje', 'Conclua 3 hábitos diferentes hoje', 'HABITS_COMPLETED', 'SESSIONS_COUNT', 3, 10),
  ('Foque antes das 9h', 'Complete uma sessão de foco iniciada antes das 9h', 'EARLY_SESSION_9AM', 'SESSIONS_COUNT', 1, 15),
  ('Complete uma missão da semana', 'Conclua uma missão do seu plano da semana', 'WEEKLY_PLAN_COMPLETED', 'SESSIONS_COUNT', 1, 15),
  ('Ganhe 50 XP hoje', 'Acumule 50 pontos de XP hoje', 'XP_EARNED', 'SESSIONS_COUNT', 50, 20)
on conflict (title) do nothing;

-- ========================================
-- Daily Tasks (user-written, up to 3/day)
-- ========================================
create table if not exists daily_task_pool (
  id bigserial primary key,
  title text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists user_daily_tasks (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  task_id bigint references daily_task_pool(id) on delete set null,
  title text,
  task_date date not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Migration: user-written titles (legacy pool rows are purged on read)
alter table user_daily_tasks add column if not exists title text;
alter table user_daily_tasks alter column task_id drop not null;

create index if not exists user_daily_tasks_profile_date_idx on user_daily_tasks(profile_id, task_date);

-- ── Recurring Daily Tasks ✓ ──────────────────────────────────────────────
-- Template: the user's persistent list of daily tasks. Each task here repeats
-- every day. Completion for a given day is tracked in daily_task_log.
create table if not exists profile_daily_tasks (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  title text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table profile_daily_tasks add column if not exists is_active boolean not null default true;
create index if not exists profile_daily_tasks_profile_idx on profile_daily_tasks(profile_id, sort_order, id);

-- Per-day completion log for recurring daily tasks.
create table if not exists daily_task_log (
  task_id bigint not null references profile_daily_tasks(id) on delete cascade,
  log_date date not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  primary key (task_id, log_date)
);

-- ── Store: Banner, Decorations, Shields ────────────────────────────────────
alter table profiles add column if not exists has_custom_banner boolean not null default false;
alter table profiles add column if not exists banner_image_url text;
alter table profiles add column if not exists equipped_decoration_id text;
alter table profiles drop column if exists equipped_energy_id;
alter table profiles add column if not exists streak_shield_count integer not null default 0;
alter table profiles add column if not exists equipped_shield_design_id text;

create table if not exists avatar_decorations (
  id text primary key,
  name text not null,
  description text not null,
  image_url text not null,
  price integer not null,
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists user_decorations (
  profile_id text not null references profiles(id) on delete cascade,
  decoration_id text not null references avatar_decorations(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  primary key (profile_id, decoration_id)
);

create table if not exists streak_shield_designs (
  id text primary key,
  name text not null,
  description text not null,
  image_url text not null,
  icon_url text not null,
  price integer not null,
  rarity text not null default 'common' check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists user_streak_shield_designs (
  profile_id text not null references profiles(id) on delete cascade,
  shield_design_id text not null references streak_shield_designs(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  primary key (profile_id, shield_design_id)
);

-- Add foreign key constraint to profiles.equipped_shield_design_id after the table exists
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'profiles'::regclass and conname = 'fk_profiles_equipped_shield'
  ) then
    alter table profiles add constraint fk_profiles_equipped_shield
      foreign key (equipped_shield_design_id) references streak_shield_designs(id) on delete set null;
  end if;
end $$;

create table if not exists streak_shield_usage (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  used_on_date date not null,
  streak_value_at_use integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists streak_shield_usage_profile_date_idx
  on streak_shield_usage (profile_id, used_on_date);

do $$ begin
  create type streak_day_status as enum ('success', 'protected', 'lost');
exception when duplicate_object then null; end $$;

create table if not exists streak_day_log (
  profile_id text not null references profiles(id) on delete cascade,
  log_date date not null,
  status streak_day_status not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, log_date)
);

-- ── XP Booster (Poção de XP Duplo) ─────────────────────────────────────────
-- Inventory of consumable potions. quantity is capped by application logic
-- (see XP_BOOST_MAX), not by a raw counter.
create table if not exists user_potions (
  profile_id text not null references profiles(id) on delete cascade,
  item_type text not null,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, item_type)
);

-- Single active 2x XP boost per user at a time; `isActive` is implied by
-- `expires_at > now()`. Activating while one is already running is rejected.
create table if not exists active_xp_boost (
  profile_id text primary key references profiles(id) on delete cascade,
  multiplier integer not null default 2,
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists active_xp_boost_expires_idx on active_xp_boost(expires_at);

-- ── Monthly Recaps ──────────────────────────────────────────────────────────
create table if not exists monthly_recaps (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  recap_month date not null,
  total_focus_minutes integer not null default 0,
  longest_streak integer not null default 0,
  league_tier text,
  league_promoted boolean default false,
  productivity_tag text,
  has_been_shared boolean default false,
  generated_at timestamptz not null default now(),
  unique (profile_id, recap_month)
);

-- Purge recaps from months before the platform existed
delete from monthly_recaps where recap_month < '2026-08-01';

-- ── Seed streak shield designs ──────────────────────────────────────────
insert into streak_shield_designs (id, name, description, image_url, icon_url, price, rarity, sort_order) values
  ('shield_basic',     'Escudo Básico',          'Proteção simples e eficaz para sua sequência',        '/streak/shield_basic.png',     '/streak/shield_basic_icon.png',     200, 'common',    1),
  ('shield_energy',    'Escudo de Energia',      'Escudo que brilha com sua energia',              '/streak/shield_energy.png',    '/streak/shield_energy_icon.png',    400, 'uncommon',  2),
  ('shield_fire',      'Escudo de Fogo',         'Proteção flamejante para guerreiros do foco',     '/streak/shield_fire.png',      '/streak/shield_fire_icon.png',      600, 'rare',      3),
  ('shield_crystal',   'Escudo de Cristal',      'Defesa transparente com poder arcano',            '/streak/shield_crystal.png',   '/streak/shield_crystal_icon.png',   800, 'rare',      4),
  ('shield_golden',    'Escudo Dourado',         'O escudo definitivo para campeões',              '/streak/shield_golden.png',    '/streak/shield_golden_icon.png',    1000, 'epic',      5),
  ('shield_legendary','Escudo Lendário',       'A proteção suprema, digna das lendas',            '/streak/shield_legendary.png', '/streak/shield_legendary_icon.png', 1500, 'legendary', 6)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  icon_url = excluded.icon_url,
  price = excluded.price,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order;

-- ── Seed avatar decorations ─────────────────────────────────────────────────
insert into avatar_decorations (id, name, description, image_url, price, rarity, sort_order) values
  ('frame_fire',     'Anel de Fogo',     'Um anel flamejante que envolve seu avatar',      '/decorations/frame_fire.svg',    500,  'common',    1),
  ('frame_crystal',  'Cristal Brilhante', 'Fragmentos de cristal com brilho etéreo',       '/decorations/frame_crystal.svg',  800,  'rare',      2),
  ('frame_aura',     'Aura Dourada',      'Uma aura dourada que pulsa com energia',        '/decorations/frame_aura.svg',     1200, 'epic',      3),
  ('frame_nucleo',   'Núcleo Cósmico',    'Um portal cósmico de poder absoluto',           '/decorations/frame_nucleo.svg',   2000, 'legendary', 4),
  ('frame_nature',   'Natureza Viva',     'Folhas e vines que crescem ao redor',           '/decorations/frame_nature.svg',   600,  'common',    5),
  ('frame_electric', 'Raio Elétrico',     'Faíscas elétricas que circundam o avatar',      '/decorations/frame_electric.svg', 700,  'common',    6),
  ('frame_cosmic',   'Nebulosa',          'Névoa cósmica com estrelas cintilantes',        '/decorations/frame_cosmic.svg',   1500, 'epic',      7),
  ('frame_diamond',  'Diamante Puro',     'Um frame de diamante com reflexos perfeitos',   '/decorations/frame_diamond.svg',  1800, 'legendary', 8)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  price = excluded.price,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order;

-- ── Calendar: time fields + external sync ──────────────────────────────────
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT true;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_time time;

CREATE TABLE IF NOT EXISTS calendar_connections (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  calendar_id text,
  sync_token text,
  is_active boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (profile_id, provider)
);

CREATE INDEX IF NOT EXISTS calendar_connections_profile_idx ON calendar_connections(profile_id);

CREATE TABLE IF NOT EXISTS external_events (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id bigint NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  recurrence text,
  last_modified timestamptz,
  is_readonly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, external_id)
);

CREATE INDEX IF NOT EXISTS external_events_profile_time_idx ON external_events(profile_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS external_events_connection_idx ON external_events(connection_id);

-- ── Category unification: backfill legacy text columns → categories(id) ────
-- Bancos existentes ainda não possuem a coluna category_id (instalações novas
-- já a declaram no create table). Adicionamos de forma idempotente para ambos.
alter table goals add column if not exists category_id bigint;
alter table tasks add column if not exists category_id bigint;
alter table kanban_tasks add column if not exists category_id bigint;
alter table weekly_plans add column if not exists category_id bigint;
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'goals' and column_name = 'category') then
    update goals g set category_id = c.id
    from categories c
    where g.category_id is null and c.user_id is null
      and c.name = case g.category
        when 'sono' then 'Sono'
        when 'estudo' then 'Estudo'
        when 'treino' then 'Treino'
        when 'foco' then 'Foco'
        else 'Outros'
      end;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'tasks' and column_name = 'category') then
    update tasks t set category_id = c.id
    from categories c
    where t.category_id is null and c.user_id is null
      and c.name = case t.category
        when 'FOCO' then 'Foco'
        when 'CORPO' then 'Treino'
        else 'Outros'
      end;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'kanban_tasks' and column_name = 'category') then
    update kanban_tasks k set category_id = c.id
    from categories c
    where k.category_id is null and c.user_id is null
      and c.name = case k.category
        when 'FOCO' then 'Foco'
        when 'CORPO' then 'Treino'
        else 'Outros'
      end;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'weekly_plans' and column_name = 'category') then
    update weekly_plans w set category_id = c.id
    from categories c
    where w.category_id is null and c.user_id is null
      and c.name = case w.category
        when 'FOCO' then 'Foco'
        when 'CORPO' then 'Treino'
        else 'Outros'
      end;
  end if;
end $$;

alter table goals alter column category_id set not null;
alter table tasks alter column category_id set not null;
alter table kanban_tasks alter column category_id set not null;
alter table weekly_plans alter column category_id set not null;

-- FK constraints para bancos existentes (em instalações novas já vêm do create table).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'goals_category_id_fkey') then
    alter table goals add constraint goals_category_id_fkey foreign key (category_id) references categories(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_category_id_fkey') then
    alter table tasks add constraint tasks_category_id_fkey foreign key (category_id) references categories(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kanban_tasks_category_id_fkey') then
    alter table kanban_tasks add constraint kanban_tasks_category_id_fkey foreign key (category_id) references categories(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'weekly_plans_category_id_fkey') then
    alter table weekly_plans add constraint weekly_plans_category_id_fkey foreign key (category_id) references categories(id);
  end if;
end $$;

create index if not exists goals_category_id_idx on goals(category_id);
create index if not exists tasks_category_id_idx on tasks(category_id);
create index if not exists kanban_tasks_category_id_idx on kanban_tasks(category_id);
create index if not exists weekly_plans_category_id_idx on weekly_plans(category_id);

-- Colunas legadas de texto não são mais usadas pela aplicação.
alter table goals drop constraint if exists goals_category_check;
alter table goals drop column if exists category;
alter table tasks drop column if exists category;
alter table kanban_tasks drop column if exists category;
alter table weekly_plans drop column if exists category;

-- ── User Auras (energia ownership) ────────────────────────────────────────
create table if not exists user_auras (
  profile_id text not null references profiles(id) on delete cascade,
  aura_type text not null check (aura_type in ('flame','water','thunder','ice','wind','metal','poison','earth','light','shadow','cosmic','crystal')),
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, aura_type)
);

delete from user_auras where aura_type in ('nature','solar');
alter table user_auras drop constraint if exists user_auras_aura_type_check;
alter table user_auras add constraint user_auras_aura_type_check check (aura_type in ('flame','water','thunder','ice','wind','metal','poison','earth','light','shadow','cosmic','crystal'));

insert into user_auras (profile_id, aura_type)
select p.id, 'flame' from profiles p
on conflict do nothing;

insert into user_auras (profile_id, aura_type)
select p.id, 'water' from profiles p
on conflict do nothing;

create index if not exists user_auras_profile_idx on user_auras(profile_id);
