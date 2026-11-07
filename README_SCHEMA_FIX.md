# SCHEMA DRIFT FIX - START HERE

## Quick Summary

Production database is missing 9 critical items causing 500 errors on 5 endpoints:
- 7 missing columns
- 1 missing table
- 1 missing seed row

All migrations exist in the repo but were never applied. This fix provides:
1. Complete analysis of all drift
2. Automated migration system
3. Schema drift detector
4. Achievement seeder
5. Error handling improvements

## Files to Read (in order)

1. **SCHEMA_FIX_COMPLETE.md** ← START HERE
   - Complete summary of all work
   - All findings and solutions
   - Next steps

2. **APPLY_MIGRATIONS.md**
   - Step-by-step guide for applying migrations
   - What each migration fixes
   - How to test

3. **PRODUCTION_SCHEMA_FIX.sql**
   - All SQL to run on production
   - Verification queries

4. **SCHEMA_DRIFT_ANALYSIS.md**
   - Detailed analysis of all drift
   - Migration tracking analysis
   - Schema source of truth

5. **SCHEMA_FIX_SUMMARY.md**
   - Complete summary with findings
   - Risk assessment
   - Verification checklist

## Quick Start

```bash
# 1. Create Neon branch
neon branches create --name fix-schema-drift

# 2. Get connection string
neon connection-string fix-schema-drift

# 3. Apply migrations
export DATABASE_URL="postgres://..."
npm run db:migrate
npm run db:seed-achievements
npm run db:schema-check

# 4. Test endpoints
curl https://branch-url/api/focus
curl https://branch-url/api/dashboard
curl https://branch-url/api/league-new/results
curl https://branch-url/api/achievements
curl https://branch-url/api/weekly-plans/1/series

# 5. Apply to production
export DATABASE_URL="postgres://production-url"
npm run db:migrate
npm run db:seed-achievements
npm run db:schema-check

# 6. Delete branch
neon branches delete fix-schema-drift
```

## New Scripts

```bash
npm run db:migrate              # Apply unapplied migrations
npm run db:schema-check         # Verify schema is up to date
npm run db:seed-achievements    # Seed missing achievements
npm run build                   # Now fails if schema is drifted
```

## What Was Fixed

### Code Changes
- **src/lib/db/achievements.ts**: Added FK error handling to skip achievements with missing database rows
- **package.json**: Added new scripts and made build check schema first

### Scripts Created
- **scripts/db-migrate.ts**: Migration runner with tracking
- **scripts/db-schema-check.ts**: Schema drift detector
- **scripts/seed-achievements.ts**: Achievement seeder

### Documentation Created
- **SCHEMA_FIX_COMPLETE.md**: Complete summary
- **APPLY_MIGRATIONS.md**: Step-by-step guide
- **PRODUCTION_SCHEMA_FIX.sql**: All SQL to run
- **SCHEMA_DRIFT_ANALYSIS.md**: Detailed analysis
- **SCHEMA_FIX_SUMMARY.md**: Summary with checklist

## Errors Fixed

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

## Risk Level

**LOW** - All migrations are idempotent (safe to run multiple times), no data loss, backward compatible.

## Next Action

Read **SCHEMA_FIX_COMPLETE.md** for complete details, then follow **APPLY_MIGRATIONS.md** to deploy.
