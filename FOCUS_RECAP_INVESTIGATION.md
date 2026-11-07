# Focus Session & Recap Investigation Report

## PROBLEM SUMMARY
November 2026 recap shows 12,117 hours (727,033 minutes) for one month, which is impossible. A month has at most 720 hours (43,200 minutes). The number crashed an INSERT into an integer column.

## INVESTIGATION FINDINGS

### 1. How Focus Sessions Are Created & Stored

**Start Flow** (`startFocusSession` in src/lib/db/focus.ts):
- Creates a row with `duration_minutes = 0` initially
- Sets `target_duration_minutes` to the user's chosen duration (default 25 min)
- Sets `started_at = now()` (server time)
- `ended_at` is NULL until the session completes
- If energy type is provided and target >= 10 min, plants garden entries immediately

**End Flow** (`endFocusSession`):
- Receives `focusedSeconds` from the client (clamped to target duration server-side)
- Calculates `durationMinutes = Math.min(finalizedFocusMinutes(focusedSeconds), targetCap)`
- Updates the row: `duration_minutes = durationMinutes`, `ended_at = now()` (or supplied endedAt)
- Records XP, coins, streak, garden finalization, and group contributions

**Cancel Flow** (`cancelFocusSession`):
- Only works within grace period (30 sec) + latency tolerance (5 sec) = 35 sec
- Deletes the row entirely (no soft delete, no status column)
- Deletes associated garden entries

### 2. Root Cause Analysis: Why Recap Shows Impossible Numbers

The recap query in `buildRecapSummary`:
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

**This query calculates time as `(ended_at - started_at) / 60` in minutes, NOT using `duration_minutes`.**

**Potential Issues:**
1. **Abandoned sessions with no ended_at**: If a session is started but never ended (app crash, user abandonment), it won't be counted (ended_at IS NOT NULL filters it out). ✓ Safe.

2. **Cancelled sessions**: Deleted entirely, so not counted. ✓ Safe.

3. **Paused sessions**: The query doesn't account for `total_paused_seconds`. If a session was paused for hours, the time span includes the pause time.
   - Example: Session started at 10:00, paused at 10:30 (30 min focused), resumed at 14:00, ended at 14:25 (25 min focused). Total span = 4h 25m, but actual focus = 55 min.
   - **This is the likely culprit for huge numbers.**

4. **Duplicate sessions**: If the same session is saved multiple times (retries, React Strict Mode, etc.), each would be counted separately.

5. **Duration stored in seconds**: The `duration_minutes` column stores minutes, but if somewhere it's being stored in seconds and then summed, it would be 60x too large.

6. **Ended_at far in the future**: If `ended_at` is set to a future timestamp by mistake, the span would be huge.

### 3. Current Data Issues

**Missing Status Column:**
- `focus_sessions` has NO `status` column (checked schema)
- Cancelled sessions are deleted, not marked as cancelled
- No way to distinguish: completed vs. abandoned vs. cancelled
- No way to exclude cancelled sessions from recap if they're not deleted

**No Pause Accounting in Recap:**
- `total_paused_seconds` exists but is NOT subtracted in the recap query
- A session paused for 8 hours would count all 8 hours as focus time

**Possible Data Corruption:**
- If `ended_at` is set to a date far in the future (e.g., 2026-12-31 instead of 2026-11-15)
- If `duration_minutes` is accidentally stored in seconds (e.g., 1500 instead of 25)
- If the same session is inserted multiple times with different ended_at values

## RECOMMENDATIONS

### TASK 1: Add Status Column & Migration

Add a `status` column to `focus_sessions`:
- `completed`: Session reached target duration
- `cancelled`: User cancelled within grace period
- `abandoned`: Session was auto-closed as stale (> target + 15 min without activity)
- `gave_up`: User explicitly gave up

Update `cancelFocusSession` to set `status = 'cancelled'` instead of deleting.

### TASK 2: Fix Recap Query

Use `duration_minutes` (the actual focused time) instead of `(ended_at - started_at)`:
```sql
SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
FROM focus_sessions
WHERE profile_id = $1
  AND status = 'completed'
  AND ended_at >= $2::timestamptz
  AND ended_at < $3::timestamptz
```

Cap each session at its target duration + small tolerance (e.g., 5%).

### TASK 3: Clean Existing Data

Before applying fixes:
1. Query for outliers: `duration_minutes > 1440` or `(ended_at - started_at) > 2 days`
2. Query for duplicates: same profile + started_at
3. Query for future ended_at: `ended_at > now() + interval '1 day'`
4. Show findings to user before deleting anything

### TASK 4: Performance Improvements

- Add index on `focus_sessions(profile_id, ended_at)` for recap queries
- Ensure pg Pool is a singleton (stored on globalThis) to avoid connection leaks
- Check for N+1 queries in dashboard/achievements/profile/settings routes
- Use Promise.all for parallel queries where possible

## VERIFICATION CHECKLIST

After fixes:
- [ ] 7 days × 4h of completed sessions = 1,680 minutes (28h)
- [ ] 1 cancelled session = 0 minutes
- [ ] No month exceeds its real number of minutes (43,200 for 30 days)
- [ ] Recap is idempotent (recomputing gives same result)
- [ ] Dashboard routes respond in < 1s (currently 2-3s)
