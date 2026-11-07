# Action Plan: Focus Session & Recap Fixes

## Overview

This plan addresses three critical issues:
1. **Impossible recap numbers** (12,117 hours for November 2026)
2. **No session status tracking** (cancelled sessions deleted, no audit trail)
3. **Database connection leaks** (new pool on every hot reload)

---

## Phase 1: Investigation & Diagnostics

### Step 1.1: Run Diagnostic Script
```bash
npx ts-node scripts/diagnose-focus-recap-issue.ts
```

**Expected Output:**
- November 2026 recap details
- Focus sessions table schema
- Outliers (huge durations, future dates, etc.)
- Duplicate sessions
- Sessions without ended_at
- Recap calculation for sample profile

**Action:** Review output and note any anomalies

### Step 1.2: Find Data Outliers
```bash
npx ts-node scripts/find-focus-outliers.ts
```

**Expected Output:**
- Sessions with duration > 1440 minutes (> 1 day)
- Sessions with time span > 2 days
- Sessions where duration > 2x target
- Duplicate sessions (same profile + started_at)
- Sessions with future ended_at
- Open sessions (no ended_at)
- November 2026 totals by profile

**Action:** Document findings and decide on cleanup strategy

### Step 1.3: Review Investigation Report
Read: `FOCUS_RECAP_INVESTIGATION.md`

**Key Points:**
- Root cause: recap query used `(ended_at - started_at) / 60` instead of `duration_minutes`
- Paused sessions counted all pause time as focus time
- No status column to distinguish session states
- Connection pool not singleton in production

---

## Phase 2: Code Changes

### Step 2.1: Review Changes
Read: `FOCUS_SESSION_CHANGES_DIFF.md`

**Key Changes:**
1. Recap query now uses `duration_minutes` with 5% cap
2. Cancelled sessions marked instead of deleted
3. Status column added to track session states
4. Pool always stored on globalThis

### Step 2.2: Verify Code Changes
All changes are already applied to:
- `src/lib/db/recap.ts` ✓
- `src/lib/db/focus.ts` ✓
- `src/lib/db.ts` ✓

**Action:** No code changes needed (already done)

---

## Phase 3: Database Migration

### Step 3.1: Backup Database
```bash
# Neon backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Or use Neon's built-in backup
# https://console.neon.tech/app/projects/[project]/backups
```

**Action:** Confirm backup exists before proceeding

### Step 3.2: Apply Migration
```bash
# Option 1: Using psql
psql $DATABASE_URL < migrations/2026-11-06-focus-session-status.sql

# Option 2: Using Neon SQL Editor
# Copy contents of migrations/2026-11-06-focus-session-status.sql
# Paste into Neon SQL Editor and execute
```

**Expected Output:**
- `CREATE TYPE` (or already exists)
- `ALTER TABLE` (add column)
- `UPDATE` (backfill existing sessions)
- `ALTER TABLE` (set default)
- `ALTER TABLE` (add constraint)
- `CREATE INDEX` (2 indexes)

**Action:** Verify all statements executed successfully

### Step 3.3: Verify Migration
```sql
-- Check status column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'focus_sessions' AND column_name = 'status';

-- Check backfill worked
SELECT status, COUNT(*) as count
FROM focus_sessions
GROUP BY status;

-- Check indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'focus_sessions' AND indexname LIKE '%status%';
```

**Expected Results:**
- Column exists with type `focus_session_status`
- Sessions distributed across 4 statuses
- 2 new indexes created

---

## Phase 4: Recap Recomputation

### Step 4.1: Recompute All Recaps
```bash
npx ts-node scripts/recompute-recaps.ts
```

**Expected Output:**
- For each profile: list of recaps with totals
- Format: `YYYY-MM-DD: XXXmin (XXh), streak: X, status: live/final`

**Action:** Review totals and verify they're reasonable

### Step 4.2: Recompute Specific Profile (if needed)
```bash
npx ts-node scripts/recompute-recaps.ts [profile-id]
```

**Action:** Verify specific profile's recaps

### Step 4.3: Verify November 2026 Recap
```sql
SELECT profile_id, recap_month, total_focus_minutes, 
       ROUND(total_focus_minutes::numeric / 60, 1) as hours,
       longest_streak, status
FROM monthly_recaps
WHERE recap_month = '2026-11-01'
ORDER BY total_focus_minutes DESC
LIMIT 5;
```

**Expected Results:**
- `total_focus_minutes` should be reasonable (< 43,200 for 30 days)
- No profile should have > 720 hours
- Status should be 'final' (past month)

---

## Phase 5: Verification

### Step 5.1: Test Case 1: Completed Sessions
```sql
-- Create test: 7 days × 4 hours = 1,680 minutes (28 hours)
-- Expected recap: 1,680 minutes

-- Verify:
SELECT SUM(duration_minutes) as total_minutes
FROM focus_sessions
WHERE profile_id = '[test-profile]'
  AND status = 'completed'
  AND started_at >= '2026-11-01T03:00:00Z'
  AND started_at < '2026-12-01T03:00:00Z';
```

**Expected:** 1,680 minutes

### Step 5.2: Test Case 2: Cancelled Sessions
```sql
-- Create test: 1 cancelled session
-- Expected recap: 0 minutes (cancelled not counted)

-- Verify:
SELECT COUNT(*) as cancelled_count
FROM focus_sessions
WHERE profile_id = '[test-profile]'
  AND status = 'cancelled'
  AND started_at >= '2026-11-01T03:00:00Z'
  AND started_at < '2026-12-01T03:00:00Z';
```

**Expected:** 1 cancelled session, not counted in recap

### Step 5.3: Test Case 3: Month Boundary
```sql
-- Verify no month exceeds 43,200 minutes (720 hours)
SELECT recap_month, total_focus_minutes,
       CASE WHEN total_focus_minutes > 43200 THEN 'ERROR' ELSE 'OK' END as status
FROM monthly_recaps
WHERE total_focus_minutes > 0
ORDER BY total_focus_minutes DESC;
```

**Expected:** All OK (no month > 43,200 minutes)

### Step 5.4: Test Case 4: Idempotency
```bash
# Run recompute twice
npx ts-node scripts/recompute-recaps.ts [profile-id]
npx ts-node scripts/recompute-recaps.ts [profile-id]

# Verify same results both times
```

**Expected:** Identical results both times

### Step 5.5: Performance Check
```bash
# Check dashboard latency
time curl -s https://your-domain/api/dashboard | jq . > /dev/null

# Check for connection spam in logs
# Should NOT see "[db] New client connected" on every hot reload
```

**Expected:** 
- Dashboard responds in < 1s
- No connection spam on hot reload

---

## Phase 6: Optional Data Cleanup

### Step 6.1: Review Outliers
From Phase 1, review the outliers found:
- Sessions with duration > 1440 minutes
- Sessions with time span > 2 days
- Duplicate sessions
- Sessions with future ended_at

### Step 6.2: Decide on Cleanup
**Options:**
1. **Keep all data** - Recaps are now correct, outliers won't affect future calculations
2. **Delete outliers** - Clean up corrupted data (requires user approval)
3. **Archive outliers** - Move to separate table for investigation

### Step 6.3: Execute Cleanup (if approved)
```sql
-- ONLY if user approves and outliers are confirmed as corruption

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

**Action:** Only run with explicit user approval

---

## Phase 7: Deployment

### Step 7.1: Deploy Code Changes
```bash
# Code changes are already in place:
# - src/lib/db/recap.ts
# - src/lib/db/focus.ts
# - src/lib/db.ts

# Deploy to production
git add .
git commit -m "fix: focus session recap calculation and status tracking"
git push origin main

# Vercel will auto-deploy
```

### Step 7.2: Monitor Logs
```bash
# Watch for errors
vercel logs --follow

# Check for connection spam
# Should NOT see "[db] New client connected" repeatedly
```

### Step 7.3: Verify in Production
```bash
# Test dashboard
curl https://your-domain/api/dashboard

# Test recap generation
curl https://your-domain/api/recap

# Check performance
time curl https://your-domain/api/dashboard
```

---

## Rollback Plan

If issues occur:

### Rollback Code
```bash
git revert [commit-hash]
git push origin main
```

### Rollback Database
```bash
# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# Or use Neon's restore feature
# https://console.neon.tech/app/projects/[project]/backups
```

---

## Success Criteria

- ✅ Migration applies without errors
- ✅ Existing sessions backfilled with correct status
- ✅ November 2026 recap shows reasonable numbers (< 720 hours)
- ✅ 7 days × 4h = 1,680 minutes (28h)
- ✅ Cancelled sessions = 0 minutes
- ✅ No month exceeds 43,200 minutes
- ✅ Recap is idempotent
- ✅ Dashboard responds in < 1s
- ✅ No connection spam on hot reload
- ✅ All tests pass

---

## Timeline

| Phase | Task | Estimated Time |
|-------|------|-----------------|
| 1 | Investigation & Diagnostics | 15 min |
| 2 | Review Code Changes | 10 min |
| 3 | Database Migration | 5 min |
| 4 | Recap Recomputation | 5 min |
| 5 | Verification | 20 min |
| 6 | Optional Cleanup | 10 min |
| 7 | Deployment | 10 min |
| **Total** | | **75 min** |

---

## Support

For questions or issues:
1. Check `FOCUS_RECAP_INVESTIGATION.md` for root cause analysis
2. Check `FOCUS_SESSION_CHANGES_DIFF.md` for detailed changes
3. Check `FOCUS_SESSION_FIX_SUMMARY.md` for overview
4. Review diagnostic script output for data issues
