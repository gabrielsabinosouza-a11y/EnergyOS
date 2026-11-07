# APPLY MIGRATIONS TO PRODUCTION

## STEP 1: Create Neon Branch (Safe)

```bash
neon branches create --name fix-schema-drift
```

Output will show:
```
Branch fix-schema-drift created
Connection string: postgres://user:password@host/dbname
```

## STEP 2: Set DATABASE_URL to Branch

```bash
export DATABASE_URL="postgres://user:password@host/dbname"
```

## STEP 3: Run Migrations

```bash
npm run db:migrate
```

Expected output:
```
Ensuring schema_migrations table exists...
Reading applied migrations...
  0 migrations already applied
Reading migration files...
  23 migration files found

Applying 23 unapplied migrations...

  Applying 2026-10-14-focus-room-timer.sql...
  ✓ 2026-10-14-focus-room-timer.sql
  Applying 2026-10-15-goals-frequency-fix.sql...
  ✓ 2026-10-15-goals-frequency-fix.sql
  ...
  Applying 2026-11-08-weekly-plan-reminder-offset.sql...
  ✓ 2026-11-08-weekly-plan-reminder-offset.sql

✓ All migrations applied successfully
```

## STEP 4: Seed Achievements

```bash
npm run db:seed-achievements
```

Expected output:
```
Seeding achievements...
  ✓ Inserted streak_master
  - streak_master already exists
  ...
  ✓ Inserted top_1_global
  ...

✓ Achievements seeded successfully
```

## STEP 5: Verify Schema

```bash
npm run db:schema-check
```

Expected output:
```
Connecting to database...

=== SCHEMA DRIFT REPORT ===

Missing tables:
  ✓ All expected tables exist

Missing columns:
  ✓ All critical columns exist

Type mismatches:
  ✓ All column types match

=== SUMMARY ===
✓ Schema is up to date
```

## STEP 6: Test Endpoints

```bash
# Get your branch URL from Vercel preview
BRANCH_URL="https://fix-schema-drift.vercel.app"

# Test all affected endpoints
curl $BRANCH_URL/api/focus
curl $BRANCH_URL/api/dashboard
curl $BRANCH_URL/api/league-new/results
curl $BRANCH_URL/api/achievements
curl $BRANCH_URL/api/weekly-plans/1/series

# All should return 2xx (not 500)
```

## STEP 7: Apply to Production

If all tests pass:

```bash
# Get production DATABASE_URL from Vercel
export DATABASE_URL="postgres://production-url"

# Run migrations on production
npm run db:migrate
npm run db:seed-achievements
npm run db:schema-check
```

## STEP 8: Verify Production

```bash
# Test production endpoints
curl https://your-app.vercel.app/api/focus
curl https://your-app.vercel.app/api/dashboard
curl https://your-app.vercel.app/api/league-new/results
curl https://your-app.vercel.app/api/achievements
curl https://your-app.vercel.app/api/weekly-plans/1/series

# All should return 2xx
```

## STEP 9: Clean Up

```bash
# Delete the test branch
neon branches delete fix-schema-drift
```

## ROLLBACK (if needed)

If something goes wrong, the branch can be deleted and recreated:

```bash
# Delete the broken branch
neon branches delete fix-schema-drift

# Create a new one and try again
neon branches create --name fix-schema-drift
```

The production database is unaffected.

## WHAT EACH MIGRATION DOES

| Migration | What it fixes |
|-----------|---|
| 2026-10-14-focus-room-timer.sql | Adds paused_at, away_started_at, end_reason to focus_sessions |
| 2026-10-18-xp-boost-purchase-idempotency.sql | Creates xp_boost_purchase_requests table |
| 2026-11-08-weekly-plan-reminder-offset.sql | Adds reminder_offset_min to weekly_plan_series |
| (schema.sql) | Adds times_top_1_global, last_top_1_global_week to profiles |
| (schema.sql) | Adds reset_at to league_groups |
| seed-achievements.ts | Inserts top_1_global achievement |

## ERRORS FIXED

After applying migrations:

| Endpoint | Error | Fixed by |
|----------|-------|----------|
| /api/focus | column "paused_at" does not exist | 2026-10-14 migration |
| /api/focus | column "away_started_at" does not exist | 2026-11-04 migration |
| /api/dashboard | column "end_reason" does not exist | 2026-11-04 migration |
| /api/league-new/results | column "reset_at" does not exist | schema.sql |
| /api/achievements | column "times_top_1_global" does not exist | schema.sql |
| /api/achievements | FK error on top_1_global | seed-achievements.ts |
| /api/weekly-plans/[id]/series | column "reminder_offset_min" does not exist | 2026-11-08 migration |
| /api/store/xp-boost | table "xp_boost_purchase_requests" does not exist | 2026-10-18 migration |
