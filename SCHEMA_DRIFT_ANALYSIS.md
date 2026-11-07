## SCHEMA DRIFT ANALYSIS

### TASK 1: MISSING ITEMS MAPPING

#### 1. focus_sessions.paused_at
- **Table**: focus_sessions
- **Code usage**: src/lib/db/focus-rooms.ts (line 2, 3, 4)
- **Migration**: migrations/2026-10-14-focus-room-timer.sql (defines it)
- **Also in**: migrations/2026-11-04-focus-grace-period.sql (adds it)
- **Schema file**: src/db-schema.sql (line ~1850: `alter table focus_sessions add column if not exists paused_at timestamptz;`)
- **Status**: Migration exists but not applied to production

#### 2. focus_sessions.away_started_at
- **Table**: focus_sessions
- **Code usage**: src/lib/db/focus.ts (line 2, 3)
- **Migration**: migrations/2026-11-04-focus-grace-period.sql (defines it)
- **Schema file**: src/db-schema.sql (line ~1855: `alter table focus_sessions add column if not exists away_started_at timestamptz;`)
- **Status**: Migration exists but not applied to production

#### 3. focus_sessions.end_reason
- **Table**: focus_sessions
- **Code usage**: src/lib/db/recap.ts (line 2, 3)
- **Migration**: 
  - migrations/2026-11-04-focus-grace-period.sql (first adds it)
  - migrations/2026-11-06-focus-session-status.sql (uses it)
- **Schema file**: src/db-schema.sql (line ~1845: `alter table focus_sessions add column if not exists end_reason text;`)
- **Status**: Migration exists but not applied to production

#### 4. league_groups.reset_at
- **Table**: league_groups
- **Code usage**: src/lib/db/league-new.ts (queries it)
- **Migration**: Defined in src/db-schema.sql but no dedicated migration
- **Schema file**: src/db-schema.sql (line ~1200: `reset_at timestamptz,` and line ~1210: `alter table league_groups add column if not exists reset_at timestamptz;`)
- **Status**: Column is in schema.sql but may not have been applied to production

#### 5. profiles.times_top_1_global
- **Table**: profiles
- **Code usage**: src/lib/db/achievements.ts (line 286-287)
- **Migration**: Defined in src/db-schema.sql but no dedicated migration
- **Schema file**: src/db-schema.sql (line ~1100: `times_top_1_global integer not null default 0,` and line ~1110: `alter table profiles add column if not exists times_top_1_global integer not null default 0;`)
- **Status**: Column is in schema.sql but may not have been applied to production

#### 6. profiles.last_top_1_global_week
- **Table**: profiles
- **Code usage**: src/lib/db/achievements.ts (line 322-323)
- **Migration**: Defined in src/db-schema.sql but no dedicated migration
- **Schema file**: src/db-schema.sql (line ~1101: `last_top_1_global_week date` and line ~1111: `alter table profiles add column if not exists last_top_1_global_week date;`)
- **Status**: Column is in schema.sql but may not have been applied to production

#### 7. weekly_plan_series.reminder_offset_min
- **Table**: weekly_plan_series
- **Code usage**: src/lib/db/weekly-plans-series.ts (line 330-335)
- **Migration**: migrations/2026-11-08-weekly-plan-reminder-offset.sql (defines it)
- **Schema file**: src/db-schema.sql (line ~1750: `reminder_offset_min int,`)
- **Status**: Migration exists but not applied to production

#### 8. xp_boost_purchase_requests (entire table)
- **Table**: xp_boost_purchase_requests
- **Code usage**: src/lib/db/xp-boost.ts (purchaseXpBoost function)
- **Migration**: migrations/2026-10-18-xp-boost-purchase-idempotency.sql (defines it)
- **Schema file**: src/db-schema.sql (line ~1900-1910)
- **Status**: Migration exists but not applied to production

#### 9. achievements.top_1_global (missing seed row)
- **Table**: achievements
- **Code usage**: src/lib/db/achievements.ts (line 22, 36, 102, 285-309)
- **Migration**: Defined in src/db-schema.sql (line ~1950-1965)
- **Schema file**: src/db-schema.sql includes the INSERT statement
- **Status**: Seed row exists in schema.sql but may not have been inserted into production

---

### TASK 2: MIGRATION TRACKING

**Current state**: No migration tracking system exists.
- No `schema_migrations` table
- No `db:migrate` script in package.json
- Only ad-hoc migration scripts (e.g., `db:migrate-group-invites`)
- Migrations are applied manually or via `db:init` which runs the entire schema

**Risk**: Impossible to know which migrations have been applied to production. Developers must manually track this.

---

### TASK 3: SCHEMA SOURCE OF TRUTH

**Analysis of four schema files**:

1. **src/db-schema.sql** (PRIMARY SOURCE OF TRUTH)
   - Contains the complete schema with all ALTER TABLE statements
   - Includes all migrations up to 2026-11-08
   - Used by `db:init` script
   - Most up-to-date

2. **migrations/*.sql** (INCREMENTAL CHANGES)
   - Individual migration files from 2026-10-14 to 2026-11-08
   - Should be applied in order
   - Some are not applied to production

3. **energyos-schema.sql** (STALE)
   - Appears to be an old backup
   - Missing recent migrations
   - Should not be used

4. **prod-schema.sql** (STALE)
   - Appears to be an old production dump
   - Missing recent migrations
   - Should not be used

5. **local-schema.sql** (STALE)
   - Appears to be an old local dump
   - Missing recent migrations
   - Should not be used

**Recommendation**: src/db-schema.sql is the source of truth. The migrations/ directory contains the incremental changes that should be applied in order.

---

### TASK 4: UNAPPLIED MIGRATIONS (in order)

All migrations from 2026-10-14 onwards may not be applied to production. The most critical ones for the reported errors are:

1. **2026-10-14-focus-room-timer.sql** - Adds paused_at to focus_sessions
2. **2026-11-04-focus-grace-period.sql** - Adds away_started_at and end_reason to focus_sessions
3. **2026-10-18-xp-boost-purchase-idempotency.sql** - Creates xp_boost_purchase_requests table
4. **2026-11-08-weekly-plan-reminder-offset.sql** - Adds reminder_offset_min to weekly_plan_series

---

### TASK 5: ACHIEVEMENTS PROBLEM

**Code-defined achievements** (src/lib/db/achievements.ts):
- streak_master
- deep_focus
- early_riser
- sleep_champion
- consistency_king
- xp_olympian
- social_spark
- top_1_global ← **MISSING FROM TABLE**
- squad_leader
- focus_companion
- flow_state
- aura_collector

**Database-seeded achievements** (src/db-schema.sql):
- streak_master ✓
- deep_focus ✓
- early_riser ✓
- sleep_champion ✓
- consistency_king ✓
- xp_olympian ✓
- social_spark ✓
- top_1_global ✓ (in schema.sql but may not be in production DB)
- squad_leader ✓
- focus_companion ✓
- flow_state ✓
- aura_collector ✓

**Missing from production**: top_1_global (and possibly others if seed was never run)

**Error flow**:
1. Code tries to compute top_1_global achievement value
2. Query succeeds (reads from profiles.times_top_1_global)
3. Code tries to INSERT into user_achievement_progress with achievement_id='top_1_global'
4. FK constraint fails because achievements.id='top_1_global' doesn't exist
5. Whole request fails with 500

**Fix**: The code already has error handling (safeQuery) that catches query failures, but the INSERT failure is not caught. Need to wrap the INSERT in try-catch.

---

### SUMMARY OF DRIFT

| Item | Type | Status | Risk |
|------|------|--------|------|
| focus_sessions.paused_at | Column | Migration exists, not applied | 500 errors on /api/focus |
| focus_sessions.away_started_at | Column | Migration exists, not applied | 500 errors on /api/focus |
| focus_sessions.end_reason | Column | Migration exists, not applied | 500 errors on /api/dashboard |
| league_groups.reset_at | Column | In schema.sql, not applied | 500 errors on /api/league-new/results |
| profiles.times_top_1_global | Column | In schema.sql, not applied | 500 errors on /api/achievements |
| profiles.last_top_1_global_week | Column | In schema.sql, not applied | 500 errors on /api/achievements |
| weekly_plan_series.reminder_offset_min | Column | Migration exists, not applied | 500 errors on /api/weekly-plans/[id]/series |
| xp_boost_purchase_requests | Table | Migration exists, not applied | 500 errors on /api/store/xp-boost |
| achievements.top_1_global | Seed row | In schema.sql, not inserted | FK error on /api/achievements |

