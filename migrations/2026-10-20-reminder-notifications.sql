-- Migration for reminder notifications and push subscriptions
-- Run with: psql "$DATABASE_URL" -f migrations/2026-10-20-reminder-notifications.sql

-- Push subscriptions for Web Push notifications
create table if not exists push_subscriptions (
  id bigserial primary key,
  profile_id text not null references profiles(id) on delete cascade,
  device_name text,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  active boolean not null default true
);

create unique index if not exists push_subscriptions_endpoint_idx on push_subscriptions(endpoint);
create index if not exists push_subscriptions_profile_idx on push_subscriptions(profile_id, active);

-- Notification delivery log (idempotency key for reminders)
create table if not exists reminder_deliveries (
  id bigserial primary key,
  series_id int,
  occurrence_id int,
  reference_key text not null, -- series_id + date + offset_min (e.g., "123:2026-10-15:15min")
  plan_title text not null,
  profile_id text not null references profiles(id) on delete cascade,
  reminder_offset_min int not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'cancelled')),
  channel text not null check (channel in ('in_app', 'push')),
  created_at timestamptz not null default now()
);

create index if not exists reminder_deliveries_profile_status_idx on reminder_deliveries(profile_id, delivery_status);
create index if not exists reminder_deliveries_scheduled_idx on reminder_deliveries(scheduled_at);
create unique index if not exists reminder_deliveries_reference_key_idx on reminder_deliveries(reference_key, channel);
create index if not exists reminder_deliveries_series_occurrence_idx on reminder_deliveries(series_id, occurrence_id);