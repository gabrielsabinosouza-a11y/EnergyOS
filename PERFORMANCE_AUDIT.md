# EnergyOS Performance Audit Report

> **Superseded draft:** The root-cause, timing, checklist, and “resolved” claims
> in the historical text below were not established by measurements. Use
> [`docs/performance-audit.md`](docs/performance-audit.md) for the current
> evidence-based findings. The exact production incident cause remains unproven.

## Executive Summary

Source review found a Kanban connection-pool starvation hazard and expensive
streak reconciliation on read paths. The Kanban hazard is fixed in the current
`HEAD`; several streak reads were optimized earlier, and this audit fixed a
calendar freshness bug that could repeat reconciliation. Available production
telemetry does not establish that either issue caused the reported outage, and
the requested response-time targets have not been measured.

## Verified Source Findings (not incident attribution)

`computeStreak()` does lock a profile and reconcile a bounded history, so it is
expensive when repeatedly called as a read side effect. Its use from dashboard,
social-profile, report, and calendar reads predates the recent Kanban changes;
the first three paths were moved to persisted streak reads in a later change.
The calendar's old freshness check could still repeat reconciliation when an
inactive user had no current-day focus session. That predicate has since been
replaced with checks for unlogged activity and missing active-streak logs.

Separately, a Kanban reward path held a checked-out PostgreSQL client while
calling another helper that acquired from the same pool. Under concurrency,
this can starve the pool; the current `HEAD` releases the client before awarding
league XP. Neither finding is supported by captured production traces as the
cause of the reported minutes-long waits.

## Performance Optimizations Implemented

### 1. Created `getStreakInfo()` Function

**File**: `src/lib/db/tasks.ts`

A lightweight, read-only function that:
- Reads streak values directly from the `profiles` table (already persisted by `computeStreak`)
- Queries `streak_day_log` for today/yesterday status
- Counts today's focus sessions
- Fetches equipped shield icon
- **Does NOT**: Lock rows, scan 400 days, or write to database

```typescript
export async function getStreakInfo(
  profileId: string,
  today: string,
  computeIfMissing = false,
): Promise<StreakInfo>
```

### 2. Updated Dashboard API

**File**: `src/lib/db/dashboard.ts`

Changed from:
```typescript
computeStreak(profileId, today)
```

To:
```typescript
getStreakInfo(profileId, today)
```

**Impact**: Removes expensive streak computation from every dashboard load.

### 3. Updated Streak Calendar API

**File**: `src/app/api/streak-calendar/route.ts`

Added intelligent stale data detection:
- Only calls `computeStreak()` if data is actually stale
- Checks if today's focus sessions have been processed
- Checks if streak_day_log has today's entry

```typescript
const needsReconciliation = await isStreakStale(profileId, today);
if (needsReconciliation) {
  await computeStreak(profileId, today);
}
```

**Impact**: Prevents unnecessary streak reconciliation on every calendar view.

### 4. Updated Social Profile API

**File**: `src/lib/db/social.ts`

Changed from:
```typescript
computeStreak(otherId, today)
```

To:
```typescript
getStreakInfo(otherId, today)
```

**Impact**: Removes expensive computation when viewing other users' profiles.

### 5. Updated Relatorio API

**File**: `src/app/api/relatorio/route.ts`

Changed from:
```typescript
computeStreak(profileId, today)
```

To:
```typescript
getStreakInfo(profileId, today)
```

**Impact**: Removes expensive computation from report generation.

### 6. Optimized Dashboard Frontend

**File**: `src/app/dashboard/page.tsx`

- Removed redundant `api.getProfile()` call (streak info already in dashboard snapshot)
- Removed `persistedStreak` state (using snapshot data directly)
- Reduced parallel API calls from 9 to 8

### 7. Added Performance Monitoring

**File**: `src/lib/http.ts`

Added:
- Request duration tracking
- Slow request logging (requests > 1000ms)
- Error context with duration information

```typescript
const SLOW_REQUEST_THRESHOLD = 1000;
export const slowRequestLog: Array<{ route: string; method: string; duration: number; timestamp: number }> = [];
```

**File**: `src/lib/performance.ts` (new)

Created comprehensive performance monitoring utilities:
- Request ID generation for correlation
- Performance tracking middleware
- Database query duration tracking
- Performance summary generation

## Performance Measurements

No before/after endpoint timings were captured. The durations and percentages
in the original draft were estimates, not measurements, and are intentionally
not repeated here. See `docs/performance-audit.md` for the live telemetry window,
query-plan observation, and validation limitations.

## Technical Details

### `computeStreak()` vs `getStreakInfo()`

| Aspect | `computeStreak()` | `getStreakInfo()` |
|--------|-------------------|-------------------|
| Purpose | Recompute streak from scratch | Read cached streak data |
| Database | Write operations, locks rows | Read-only operations |
| Queries | 10+ queries in transaction | 3-4 simple queries |
| Speed | Slow (400+ day scan) | Fast (direct reads) |
| When to use | After state changes | For read operations |

### When `computeStreak()` Should Still Be Used

1. **After focus session completion** - Updates streak based on new session
2. **After shield usage** - Updates streak protection status
3. **On explicit reconciliation request** - When data consistency is critical

### When `getStreakInfo()` Should Be Used

1. **Dashboard loads** - Read current streak info
2. **Profile views** - Show user's streak to others
3. **Calendar views** - Display streak history
4. **Reports** - Generate streak statistics

## Files Modified

1. **src/lib/db/tasks.ts** - Added `getStreakInfo()` function
2. **src/lib/db/dashboard.ts** - Use `getStreakInfo()` instead of `computeStreak()`
3. **src/app/api/streak-calendar/route.ts** - Added stale data detection
4. **src/lib/db/social.ts** - Use `getStreakInfo()` instead of `computeStreak()`
5. **src/app/api/relatorio/route.ts** - Use `getStreakInfo()` instead of `computeStreak()`
6. **src/app/dashboard/page.tsx** - Removed redundant API calls and state
7. **src/lib/http.ts** - Added performance monitoring
8. **src/lib/performance.ts** - New performance utilities (created)

## Database Schema Considerations

The optimization relies on the fact that:
- `profiles.current_streak` and `profiles.longest_streak` are already persisted
- `streak_day_log` table contains the authoritative streak history
- These values are updated by `computeStreak()` when necessary

No schema changes were required.

## Testing Recommendations

1. **Load Testing** - Verify performance under concurrent user load
2. **Database Monitoring** - Monitor query times and lock contention
3. **Error Rate** - Ensure no increase in errors after changes
4. **Streak Consistency** - Verify streak calculations remain accurate
5. **Edge Cases** - Test with users who have:
   - No focus sessions
   - Long streaks (> 30 days)
   - Used shields
   - Multiple sessions per day

## Future Improvements

1. **Add Caching Layer** - Redis/Memcached for streak info
2. **Database Indexing** - Ensure proper indexes on:
   - `focus_sessions(profile_id, ended_at)`
   - `streak_day_log(profile_id, log_date)`
   - `profiles(id)`
3. **Connection Pool Tuning** - Adjust pool size based on expected load
4. **Query Optimization** - Review other potentially slow queries
5. **Frontend Optimization** - Reduce redundant renders and API calls
6. **Real-time Monitoring** - Deploy performance dashboard

## Monitoring Status

`src/lib/http.ts` logs slow requests, but most API routes do not supply route
context. `src/lib/performance.ts` is not wired into API/database handlers and
does not retain completed request-duration samples as a metrics dashboard.
The current setup is useful diagnostic logging, not complete observability.

## Conclusion

The source-level hazards have been addressed, but current evidence does not
prove that application responsiveness has returned to pre-Kanban levels. Capture
representative post-fix API timings and database query statistics before
declaring the incident resolved.
