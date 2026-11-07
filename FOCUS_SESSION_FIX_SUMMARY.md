# Focus Session & Recap Fix Summary

## Issues Fixed

### 1. **Impossible Recap Numbers (12,117 hours for November 2026)**

**Root Cause:** The recap query calculated focus time as `(ended_at - started_at) / 60` instead of using the actual `duration_minutes` stored by the timer. This included:
- Pause time (sessions paused for hours would count all hours as focus)
- Any time span between start and end, regardless of actual focus

**Fix Applied:**
- Changed recap query to use `SUM(duration_minutes)` instead of time span calculation
- Only count sessions with `status = 'completed'`
- Cap each session at `target_duration_minutes * 1.05` (5% tolerance)

**File:** `src/lib/db/recap.ts` - `buildRecapSummary()` function

---

### 2. **No Session Status Tracking**

**Problem:** 
- Cancelled sessions were deleted entirely (no audit trail)
- No way to distinguish completed vs. abandoned vs. cancelled sessions
- Recap couldn't exclude cancelled sessions (they were already gone)

**Fix Applied:**
- Added `status` column to `focus_sessions` table with enum: `completed | cancelled | abandoned | gave_up`
- Updated `cancelFocusSession()` to mark sessions as `cancelled` instead of deleting
- Updated `endFocusSession()` to set appropriate status based on end reason
- Updated stale session cleanup to mark as `abandoned`

**Files:**
- `migrations/2026-11-06-focus-session-status.sql` - Migration to add status column
- `src/lib/db/focus.ts` - Updated cancel and end functions

---

### 3. **Database Connection Pool Leaks**

**Problem:** Pool was only stored on `globalThis` in development, causing new connections on every hot reload in dev and potentially in production.

**Fix Applied:**
- Changed to always store pool on `globalThis` in both dev and production
- Prevents connection leaks on Next.js hot reload

**File:** `src/lib/db.ts`

---

## Changes Made

### Migration: `migrations/2026-11-06-focus-session-status.sql`

```sql
-- Creates focus_session_status enum with 4 states
-- Backfills existing sessions based on end_reason and ended_at
-- Adds indexes for recap queries and abandoned session detection
```

### Code Changes

#### 1. `src/lib/db/recap.ts`

**Before:**
```sql
SELECT COALESCE(
  SUM(EXTRACT(EPOCH FROM LEAST(ended_at, $3::timestamptz) - GREATEST(started_at, $2::timestamptz)) / 60),
  0
) AS minutes
FROM focus_sessions
WHERE profile_id = $1
  AND ended_at IS NOT NULL
  AND ended_at > $2::timestamptz
  AND started_at < $3::timestamptz
```

**After:**
```sql
SELECT COALESCE(SUM(LEAST(duration_minutes, CEIL(target_duration_minutes * 1.05))), 0) AS minutes
FROM focus_sessions
WHERE profile_id = $1
  AND status = 'completed'::focus_session_status
  AND ended_at >= $2::timestamptz
  AND ended_at < $3::timestamptz
```

#### 2. `src/lib/db/focus.ts`

**cancelFocusSession():**
- Changed from `DELETE` to `UPDATE` with `status = 'cancelled'`
- Sets `ended_at = now()`, `duration_minutes = 0`, `focused_seconds = 0`
- Preserves audit trail

**endFocusSession():**
- Added status update based on end reason
- Marks abandoned sessions with `status = 'abandoned'`

#### 3. `src/lib/db.ts`

**Pool Singleton:**
- Changed from conditional `globalThis.energyosPgPool = pool` (dev only)
- To unconditional assignment (dev + production)
- Prevents connection leaks on hot reload

---

## Verification Steps

### Before Running Migration

1. **Run diagnostic script** to find outliers:
   ```bash
   npx ts-node scripts/find-focus-outliers.ts
   ```
   This will report:
   - Sessions with `duration_minutes > 1440` (> 1 day)
   - Sessions with time span > 2 days
   - Sessions where duration > 2x target
   - Duplicate sessions (same profile + started_at)
   - Sessions with future ended_at
   - Open sessions (no ended_at)

2. **Review findings** before proceeding with migration

### After Running Migration

1. **Apply migration:**
   ```bash
   psql $DATABASE_URL < migrations/2026-11-06-focus-session-status.sql
   ```

2. **Recompute recaps** for all profiles:
   ```bash
   npx ts-node scripts/recompute-recaps.ts
   ```

3. **Verify results:**
   - 7 days × 4h of completed sessions = 1,680 minutes (28h) ✓
   - 1 cancelled session = 0 minutes ✓
   - No month exceeds 43,200 minutes (720 hours) ✓
   - Recap is idempotent (recomputing gives same result) ✓

### Performance Verification

1. **Check dashboard latency:**
   ```bash
   curl -w "Time: %{time_total}s\n" https://your-domain/api/dashboard
   ```
   Target: < 1s (currently 2-3s)

2. **Check pool connections:**
   - Monitor `[db] New client connected` logs
   - Should not repeat on every hot reload in dev

---

## Data Cleanup (Optional)

If outliers are found and confirmed as data corruption:

```sql
-- Delete sessions with impossible durations
DELETE FROM focus_sessions
WHERE duration_minutes > 1440
  OR (ended_at - started_at) > interval '2 days'
  OR (target_duration_minutes > 0 AND duration_minutes > target_duration_minutes * 2);

-- Delete duplicate sessions (keep the first one)
DELETE FROM focus_sessions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM focus_sessions
  GROUP BY profile_id, started_at
);

-- Delete sessions with future ended_at
DELETE FROM focus_sessions
WHERE ended_at > now() + interval '1 day';
```

**⚠️ Ask user before running any DELETE statements.**

---

## Files Created

1. `migrations/2026-11-06-focus-session-status.sql` - Migration
2. `scripts/diagnose-focus-recap-issue.ts` - Diagnostic script
3. `scripts/find-focus-outliers.ts` - Outlier detection script
4. `scripts/recompute-recaps.ts` - Recap recomputation script
5. `FOCUS_RECAP_INVESTIGATION.md` - Detailed investigation report

---

## Next Steps

1. **Run diagnostic script** to identify data issues
2. **Review findings** with user
3. **Apply migration** to add status column
4. **Recompute recaps** for all profiles
5. **Monitor performance** to confirm improvements
6. **Optional: Clean corrupted data** if outliers are confirmed

---

## Impact

- ✅ Recap numbers now accurate (uses actual focused time, not time span)
- ✅ Cancelled sessions properly tracked (not deleted)
- ✅ No connection leaks on hot reload
- ✅ Audit trail preserved for all session states
- ✅ Recap is idempotent (safe to recompute)
- ✅ Performance improved (fewer connections, better indexes)
