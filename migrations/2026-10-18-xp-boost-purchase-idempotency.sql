create table if not exists xp_boost_purchase_requests (
  profile_id text not null references profiles(id) on delete cascade,
  idempotency_key uuid not null,
  requested_quantity integer not null,
  balance integer not null,
  potion_quantity integer not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, idempotency_key)
);
