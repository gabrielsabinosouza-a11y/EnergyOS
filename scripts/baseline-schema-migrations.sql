-- Baseline schema_migrations: mark every migration in migrations/ as already
-- applied. Verified 2026-11-24 via read-only information_schema checks — all
-- objects created/altered by these files exist in the production database.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id serial PRIMARY KEY,
  filename text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (filename) VALUES
  ('2026-10-14-focus-room-timer.sql'),
  ('2026-10-15-goals-frequency-fix.sql'),
  ('2026-10-15-recap-schema.sql'),
  ('2026-10-18-goals-remove-monthly.sql'),
  ('2026-10-18-recap-schema-improvements.sql'),
  ('2026-10-18-streak-master-tiers.sql'),
  ('2026-10-18-xp-boost-purchase-idempotency.sql'),
  ('2026-10-19-recap-enhancements.sql'),
  ('2026-10-20-reminder-notifications.sql'),
  ('2026-10-21-optional-scheduling.sql'),
  ('2026-10-22-kanban-task-image.sql'),
  ('2026-10-23-streak-day-log-fix.sql'),
  ('2026-11-03-league-tier-expansion.sql'),
  ('2026-11-04-focus-grace-period.sql'),
  ('2026-11-04-league-rewards-top1-global.sql'),
  ('2026-11-05-league-legacy-tiers.sql'),
  ('2026-11-05-weekly-plans-note.sql'),
  ('2026-11-06-focus-session-status.sql'),
  ('2026-11-07-weekly-plan-series-schema-fix.sql'),
  ('2026-11-07-xp-potion-cap-constraint.sql'),
  ('2026-11-08-weekly-plan-reminder-offset.sql'),
  ('2026-11-09-planner-items-completions.sql'),
  ('2026-11-21-garden-aura-id-and-statuses.sql'),
  ('2026-11-21-seasonal-events.sql'),
  ('2026-11-21-seasonal-legendary.sql'),
  ('2026-11-21-user-auras-seasonal.sql'),
  ('2026-11-23-user-seasonal-theme.sql'),
  ('2026-11-24-store-notification-seen.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
