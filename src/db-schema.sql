create table if not exists profiles (
  id uuid primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists daily_checkins (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  checkin_date date not null,
  sleep_hours numeric(4, 2),
  study_minutes integer,
  training_minutes integer,
  energy_score smallint check (energy_score between 1 and 5),
  unique (profile_id, checkin_date)
);

create table if not exists tasks (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  category text not null,
  due_date date not null,
  completed_at timestamptz
);

create index if not exists daily_checkins_profile_date_idx on daily_checkins(profile_id, checkin_date desc);
create index if not exists tasks_profile_due_date_idx on tasks(profile_id, due_date);

-- ============================================================
-- Adições v2 — metas, hábitos e configurações de usuário
-- Adicionado em: implementação das páginas /metas e /configuracoes
-- ============================================================

create table if not exists goals (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
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
  profile_id uuid primary key references profiles(id) on delete cascade,
  notifications_enabled boolean not null default true,
  preferred_theme text not null default 'system' check (preferred_theme in ('system','light','dark')),
  sleep_time time,
  focus_time time
);

create index if not exists goals_profile_idx on goals(profile_id);
create index if not exists habits_goal_idx on habits(goal_id);

-- ============================================================
-- Mudança v3 (OpenCode — área de metas/hábitos/persistência)
-- Data: 2026-08-24
--
-- ADICIONADO: tabela habit_completions
-- Motivo: permitir marcar hábito como concluído por dia
-- (o hábito em si não muda de estado; o registro diário é
-- o que alimenta progresso e futuras métricas de streak).
-- Idempotente: seguro rodar contra Postgres local (Docker)
-- e Neon (mesma DATABASE_URL / protocolo Postgres).
-- Aplicar com: npm run db:init
-- ============================================================

create table if not exists habit_completions (
  habit_id bigint not null references habits(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  completed_date date not null,
  primary key (habit_id, completed_date)
);

create index if not exists habit_completions_profile_date_idx on habit_completions(profile_id, completed_date);
