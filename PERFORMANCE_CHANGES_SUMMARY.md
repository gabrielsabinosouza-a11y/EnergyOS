# Performance Optimization Changes Summary

> **Superseded draft:** This file's original timing table, checked acceptance
> criteria, and root-cause attribution were not verified. See
> [`docs/performance-audit.md`](docs/performance-audit.md) for the current
> evidence-based status. The exact production incident cause remains unproven.

## Problem Statement
Users reported multi-minute page loads and slow requests after Kanban changes.
The source and available telemetry do not establish that the Kanban work caused
all reported symptoms.

## Root Cause
Streak reconciliation is an expensive read-side effect, but its use on
dashboard, profile, and report paths predates the recent Kanban changes. A
separate Kanban reward path could starve the shared database pool under
concurrency and is fixed in the current `HEAD`. Neither issue is proven to be
the production incident's exact cause.

## Solution Overview
Introduced a lightweight `getStreakInfo()` function for read operations, reserving `computeStreak()` for write operations only (after focus sessions, shield usage, etc.).

## Files Modified

### 1. src/lib/db/tasks.ts
**Added:**
- `getStreakInfo()` function - Lightweight read-only streak info retrieval
- `isStreakStale()` helper - Determines if streak data needs reconciliation

**Impact:** Provides fast, read-only access to streak information without expensive recomputation.

### 2. src/lib/db/dashboard.ts
**Changed:**
- Import: Added `getStreakInfo` to imports
- `buildDashboardSnapshot()`: Uses `getStreakInfo()` instead of `computeStreak()`

**Impact:** Dashboard loads now use fast read-only queries instead of expensive streak computation.

### 3. src/app/api/streak-calendar/route.ts
**Added:**
- `isStreakStale()` function - Checks if streak data needs updating
- Stale data detection logic - Only calls `computeStreak()` when necessary

**Impact:** Calendar views only recompute streak when data is actually stale.

### 4. src/lib/db/social.ts
**Changed:**
- Import: Replaced `computeStreak` with `getStreakInfo`
- Profile fetching: Uses `getStreakInfo()` for streak data

**Impact:** Viewing other users' profiles no longer triggers expensive streak computation.

### 5. src/app/api/relatorio/route.ts
**Changed:**
- Import: Replaced `computeStreak` with `getStreakInfo`
- Report generation: Uses `getStreakInfo()` for streak data

**Impact:** Report generation uses fast read-only queries.

### 6. src/app/dashboard/page.tsx
**Changed:**
- Removed: `persistedStreak` state
- Removed: Redundant `api.getProfile()` API call
- Updated: Streak display to use snapshot data directly

**Impact:** Reduced parallel API calls from 9 to 8, eliminated redundant data fetching.

### 7. src/lib/http.ts
**Added:**
- `SLOW_REQUEST_THRESHOLD` constant (1000ms)
- `slowRequestLog` array for tracking slow requests
- `logSlowRequest()` function for logging
- Performance tracking in `handleRoute()`

**Impact:** All API requests are now timed, slow requests are logged for monitoring.

### 8. src/lib/performance.ts (NEW)
**Created:** Comprehensive performance monitoring utilities

**Includes:**
- Request ID generation for correlation
- Performance tracking middleware
- Database query duration tracking
- Performance summary generation

## Performance Improvements

### Measurements

No before/after timing measurements are available. The previous figures were
targets, not results.

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dashboard / API latency | Not measured | Not measured | Not established |
| Database load | No representative baseline | No representative post-fix sample | Not established |

### Specific Endpoints Optimized
1. `/api/dashboard` - Uses `getStreakInfo()` instead of `computeStreak()`
2. `/api/streak-calendar` - Only calls `computeStreak()` when data is stale
3. `/api/social/profile/[id]` - Uses `getStreakInfo()` instead of `computeStreak()`
4. `/api/relatorio` - Uses `getStreakInfo()` instead of `computeStreak()`

## Technical Details

### When to Use `computeStreak()` vs `getStreakInfo()`

**Use `computeStreak()` when:**
- A focus session completes (updates streak)
- A shield is used (protects streak)
- Explicit reconciliation is needed
- State-changing operations occur

**Use `getStreakInfo()` when:**
- Displaying streak info on dashboard
- Viewing user profiles
- Generating reports
- Reading streak history
- Any read-only operation

### `getStreakInfo()` Implementation

The new function:
1. Reads `current_streak`, `longest_streak`, `streak_shield_count` from profiles table
2. Counts today's focus sessions (to determine if today is qualified)
3. Reads today/yesterday status from `streak_day_log`
4. Fetches equipped shield icon URL
5. Returns complete `StreakInfo` object

All operations are read-only and require no row locking.

### Stale Data Detection

The current streak-calendar route checks for focus or shield activity newer
than its log and for active streaks missing a log through yesterday. It no
longer relies on today's log alone, since a day without a focus session may
intentionally have no current-day log.

## Database Impact

### Before
- Every page load: Row locking with `FOR UPDATE`
- Every page load: 400+ day scan of focus_sessions
- Every page load: Multiple write operations to streak_day_log
- High database load, lock contention

### After
- Read operations: No row locking
- Read operations: Simple SELECT queries only
- Write operations: Only when necessary
- Low database load, no lock contention

## Monitoring

`src/lib/http.ts` logs slow requests, but most API routes do not supply route
context. `src/lib/performance.ts` is not wired into API/database handlers and
does not provide a retained metrics dashboard. Current observability is
incomplete; see `docs/performance-audit.md`.

## Validation Status

- Focused streak reconciliation tests: 10/10 passed.
- `npx tsc --noEmit`: passed after restoring nullable dashboard status props.
- Full `npm test`: recap tests requiring local PostgreSQL were blocked because
  `localhost:5432` refused the connection.
- Scoped ESLint: not clean; it reports an existing error at
  `src/app/dashboard/page.tsx:264` and existing warnings.
- Performance targets, user flows, and concurrent load have not been verified.

## Rollback Plan

If issues arise, the changes can be easily rolled back by:
1. Reverting to `computeStreak()` in all modified files
2. Removing the `getStreakInfo()` function
3. Removing the performance monitoring additions

However, this would restore the performance regression, so we recommend addressing any issues forward rather than rolling back.

## Files Summary

### Modified Files (8):
1. `src/lib/db/tasks.ts` - Added `getStreakInfo()` and `isStreakStale()`
2. `src/lib/db/dashboard.ts` - Use `getStreakInfo()` 
3. `src/app/api/streak-calendar/route.ts` - Added stale data detection
4. `src/lib/db/social.ts` - Use `getStreakInfo()`
5. `src/app/api/relatorio/route.ts` - Use `getStreakInfo()`
6. `src/app/dashboard/page.tsx` - Removed redundant calls
7. `src/lib/http.ts` - Added performance monitoring

### New Files (2):
1. `src/lib/performance.ts` - Performance monitoring utilities
2. `PERFORMANCE_AUDIT.md` - Complete audit documentation
3. `PERFORMANCE_CHANGES_SUMMARY.md` - This file

## Next Steps

1. **Deploy to staging** and verify performance improvements
2. **Monitor** slow request logs and database metrics
3. **Load test** with expected user concurrency
4. **Tune** database connection pool size if needed
5. **Consider** adding Redis caching for further performance gains

## Acceptance Criteria

The performance acceptance criteria have not been demonstrated by measured
post-fix traffic or load testing. The source findings and limitations are
documented in `docs/performance-audit.md`.

## Conclusion

The identified source-level issues have been addressed, but current evidence
does not prove the outage is resolved or the requested latency targets are met.
