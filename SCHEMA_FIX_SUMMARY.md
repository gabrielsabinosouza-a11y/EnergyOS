## SCHEMA DRIFT FIX - COMPLETE SUMMARY

### EXECUTIVE SUMMARY

Production database is missing 8 critical items that cause 500 errors on 5 endpoints:
- 6 missing columns (focus_sessions, league_groups, profiles, weekly_plan_series)
- 1 missing table (xp_boost_purchase_requests)
- 1 missing seed row (achievements.top_1_global)

All migrations exist in the repo but were never applied to production. No migration tracking system exists.

---

## TASK 1: MISSING ITEMS MAPPING

### Missing Columns

| Column | Table | Code Location | Migration | Status |
|--------|-------|---|---|---|
| paused_at | focus_sessions | src/lib/db/focus-rooms.ts | 2026-10-14-focus-room-timer.sql | Not applied |
| away_started_at | focus_sessions | src/lib/db/focus.ts | 2026-11-04-focus-grace-period.sql | Not applied |
| end_reason | focus_sessions | src/lib/db/recap.ts | 2026-11-04-focus-grace-period.sql | Not applied |
| reset_at | league_groups | src/lib/db/league-new.ts | In schema.sql | Not applied |
| times_top_1_global | profiles | src/lib/db/achievements.ts | In schema.sql | Not applied |
| last_top_1_global_week | profiles | src/lib/db/achievements.ts | In schema.sql | Not applied |
| reminder_offset_min | weekly_plan_series | src/lib/db/weekly-plans-series.ts | 2026-11-08-weekly-plan-reminder-offset.sql | Not applied |

### Missing Table

| Table | Code Location | Migration | Status |
|-------|---|---|---|
| xp_boost_purchase_requests | src/lib/db/xp-boost.ts | 2026-10-18-xp-boost-purchase-idempotency.sql | Not applied |

### Missing Seed Row

| Table | Row | Code Location | Status |
|-------|-----|---|---|
| achievements | top_1_global | src/lib/db/achievements.ts | Not inserted |

---

## TASK 2: MIGRATION TRACKING

**Current state**: No migration tracking system exists.

**Problems**:
- No `schema_migrations` table
- No `db:migrate` script
- Impossible to know which migrations have been applied
- Developers must manually track this

**Solution**: Created `scripts/db-migrate.ts` that:
1. Creates `schema_migrations` table if it doesn't exist
2. Reads all .sql files from migrations/ directory
3. Applies only unapplied migrations in order
4. Records each migration in schema_migrations table
5. Is idempotent (safe to run multiple times)

---

## TASK 3: SCHEMA SOURCE OF TRUTH

**Analysis**:

1. **src/db-schema.sql** ✓ PRIMARY SOURCE OF TRUTH
   - Contains complete schema with all ALTER TABLE statements
   - Includes all migrations up to 2026-11-08
   - Used by db:init script
   - Most up-to-date

2. **migrations/*.sql** ✓ INCREMENTAL CHANGES
   - Individual migration files from 2026-10-14 to 2026-11-08
   - Should be applied in order
   - Some are not applied to production

3. **energyos-schema.sql** ✗ STALE
   - Old backup, missing recent migrations

4. **prod-schema.sql** ✗ STALE
   - Old production dump, missing recent migrations

5. **local-schema.sql** ✗ STALE
   - Old local dump, missing recent migrations

**Recommendation**: Use src/db-schema.sql as source of truth. Apply migrations/ in order.

---

## TASK 4: ACHIEVEMENTS PROBLEM

**Code-defined achievements** (src/lib/db/achievements.ts):
- streak_master, deep_focus, early_riser, sleep_champion, consistency_king, xp_olympian, social_spark, **top_1_global**, squad_leader, focus_companion, flow_state, aura_collector

**Database-seeded achievements** (src/db-schema.sql):
- All 13 achievements are defined in the INSERT statement

**Problem**: top_1_global (and possibly others) are not in production database

**Error flow**:
1. Code computes top_1_global value from profiles.times_top_1_global
2. Code tries to INSERT into user_achievement_progress with achievement_id='top_1_global'
3. FK constraint fails: achievements.id='top_1_global' doesn't exist
4. Whole /api/achievements request fails with 500

**Fix implemented**:
1. Created `scripts/seed-achievements.ts` to insert all achievements (idempotent)
2. Modified `src/lib/db/achievements.ts` to catch FK errors and skip that achievement instead of failing the whole request
3. Error is logged but endpoint returns other achievements successfully

---

## TASK 5: DATABASE COMPARISON

**To compare hosts without printing password**:

```bash
# Extract host from DATABASE_URL (Vercel production)
echo $DATABASE_URL | grep -oP '(?<=@)[^/]+' | cut -d: -f1

# Extract host from .env.local (dev)
grep DATABASE_URL .env.local | grep -oP '(?<=@)[^/]+' | cut -d: -f1
```

**Whether dev and production share one Neon branch**:
- If hosts are the same: they share one branch (likely main)
- If hosts are different: they use separate branches

---

## TASK 6: STOP THIS FROM HAPPENING AGAIN

### Solution: Automated Migration System

**Created files**:
1. `scripts/db-migrate.ts` - Applies unapplied migrations in order
2. `scripts/db-schema-check.ts` - Verifies schema matches expected state
3. `scripts/seed-achievements.ts` - Seeds missing achievements

**Updated package.json**:
```json
{
  "scripts": {
    "build": "npm run db:schema-check && next build",
    "db:migrate": "npx ts-node scripts/db-migrate.ts",
    "db:schema-check": "npx ts-node scripts/db-schema-check.ts",
    "db:seed-achievements": "npx ts-node scripts/seed-achievements.ts"
  }
}
```

**How it works**:
1. `npm run db:migrate` applies all unapplied migrations
2. `npm run db:schema-check` verifies schema is up to date
3. `npm run build` fails if schema is drifted (prevents deploying broken code)
4. `npm run db:seed-achievements` ensures all achievements exist

**Benefits**:
- Migrations are tracked in schema_migrations table
- Build fails if schema is drifted
- Developers can't deploy code that requires missing columns
- All scripts are idempotent (safe to run multiple times)

---

## NEXT STEPS

### 1. Create Neon Branch (SAFE)
```bash
neon branches create --name fix-schema-drift
```

### 2. Get Branch Connection String
```bash
neon connection-string fix-schema-drift
```

### 3. Apply Migrations (SAFE - all idempotent)
```bash
# Set DATABASE_URL to branch connection string
export DATABASE_URL="postgres://..."

# Run all unapplied migrations
npm run db:migrate

# Seed missing achievements
npm run db:seed-achievements

# Verify schema
npm run db:schema-check
```

### 4. Test Endpoints
```bash
# Should all return 2xx now:
curl https://your-app.vercel.app/api/focus
curl https://your-app.vercel.app/api/dashboard
curl https://your-app.vercel.app/api/league-new/results
curl https://your-app.vercel.app/api/achievements
curl https://your-app.vercel.app/api/weekly-plans/[id]/series
```

### 5. Apply to Production
```bash
# If all tests pass, apply to production database
export DATABASE_URL="postgres://production-url"
npm run db:migrate
npm run db:seed-achievements
npm run db:schema-check
```

### 6. Delete Branch
```bash
neon branches delete fix-schema-drift
```

---

## FILES CREATED

1. **scripts/db-migrate.ts** - Migration runner with tracking
2. **scripts/db-schema-check.ts** - Schema drift detector
3. **scripts/seed-achievements.ts** - Achievement seeder
4. **SCHEMA_DRIFT_ANALYSIS.md** - Detailed analysis
5. **PRODUCTION_SCHEMA_FIX.sql** - All SQL to run
6. **package.json** - Updated with new scripts

---

## VERIFICATION CHECKLIST

After applying migrations:

- [ ] `npm run db:schema-check` returns "✓ Schema is up to date"
- [ ] `/api/focus` returns 2xx
- [ ] `/api/dashboard` returns 2xx
- [ ] `/api/league-new/results` returns 2xx
- [ ] `/api/achievements` returns 2xx with all 13 achievements
- [ ] `/api/weekly-plans/[id]/series` returns 2xx
- [ ] XP potion purchase works (no 500 errors)
- [ ] `schema_migrations` table has 8+ rows

---

## RISK ASSESSMENT

**Risk level**: LOW

**Why**:
- All migrations use IF NOT EXISTS (idempotent)
- No data loss (only adding columns/tables)
- No schema changes to existing columns
- All changes are backward compatible
- Can be rolled back by deleting rows from schema_migrations and re-running

**Mitigation**:
- Test on Neon branch first
- Run db:schema-check to verify
- Test all affected endpoints
- Keep branch for 24 hours before deleting

