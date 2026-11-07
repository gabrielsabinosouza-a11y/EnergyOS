# Detailed Code Changes

## 1. Migration: Add Status Column

**File:** `migrations/2026-11-06-focus-session-status.sql`

```sql
-- Creates focus_session_status enum type
do $$ begin
  create type focus_session_status as enum ('completed', 'cancelled', 'abandoned', 'gave_up');
exception when duplicate_object then null; end $$;

-- Adds status column to focus_sessions
alter table focus_sessions add column if not exists status focus_session_status;

-- Backfills existing sessions based on end_reason and ended_at
update focus_sessions
set status = case
  when end_reason = 'gave_up' then 'gave_up'::focus_session_status
  when ended_at is null then 'abandoned'::focus_session_status
  else 'completed'::focus_session_status
end
where status is null;

-- Sets default for new rows
alter table focus_sessions alter column status set default 'completed'::focus_session_status;

-- Adds constraint to ensure status is always set
alter table focus_sessions add constraint focus_sessions_status_not_null check (status is not null) not valid;

-- Creates indexes for recap queries and abandoned session detection
create index if not exists focus_sessions_profile_status_ended_idx 
  on focus_sessions(profile_id, status, ended_at desc)
  where ended_at is not null;

create index if not exists focus_sessions_abandoned_idx
  on focus_sessions(profile_id, started_at)
  where status = 'abandoned' and ended_at is null;
```

---

## 2. Fix Recap Query

**File:** `src/lib/db/recap.ts` - `buildRecapSummary()` function

### Before:
```typescript
pool.query<{ minutes: string | number }>(
  `SELECT COALESCE(
            SUM(EXTRACT(EPOCH FROM LEAST(ended_at, $3::timestamptz) - GREATEST(started_at, $2::timestamptz)) / 60),
            0
          ) AS minutes
     FROM focus_sessions
    WHERE profile_id = $1
      AND ended_at IS NOT NULL
      AND ended_at > $2::timestamptz
      AND started_at < $3::timestamptz`,
  [profileId, monthStartIso, monthEndIso],
),
```

### After:
```typescript
pool.query<{ minutes: string | number }>(
  `SELECT COALESCE(SUM(LEAST(duration_minutes, CEIL(target_duration_minutes * 1.05))), 0) AS minutes
     FROM focus_sessions
    WHERE profile_id = $1
      AND status = 'completed'::focus_session_status
      AND ended_at >= $2::timestamptz
      AND ended_at < $3::timestamptz`,
  [profileId, monthStartIso, monthEndIso],
),
```

**Changes:**
- ✅ Use `duration_minutes` (actual focused time) instead of `(ended_at - started_at) / 60`
- ✅ Only count sessions with `status = 'completed'`
- ✅ Cap each session at `target_duration_minutes * 1.05` (5% tolerance)
- ✅ Use `>=` instead of `>` for consistency

---

## 3. Update Cancel Function

**File:** `src/lib/db/focus.ts` - `cancelFocusSession()` function

### Before:
```typescript
const result = await client.query<{ id: number }>(
  `delete from focus_sessions
    where profile_id = $1 and id = $2 and ended_at is null
      and started_at >= now() - make_interval(secs => $3)
    returning id`,
  [profileId, sessionId, windowSecs],
);
```

### After:
```typescript
const result = await client.query<{ id: number }>(
  `update focus_sessions
    set status = 'cancelled'::focus_session_status, ended_at = now(), duration_minutes = 0, focused_seconds = 0,
        paused_at = null, away_started_at = null
    where profile_id = $1 and id = $2 and ended_at is null
      and started_at >= now() - make_interval(secs => $3)
    returning id`,
  [profileId, sessionId, windowSecs],
);
```

**Changes:**
- ✅ Changed from `DELETE` to `UPDATE`
- ✅ Set `status = 'cancelled'`
- ✅ Set `ended_at = now()` to mark when it was cancelled
- ✅ Set `duration_minutes = 0` and `focused_seconds = 0` (no focus time)
- ✅ Preserves audit trail (row still exists)

---

## 4. Update Stale Session Cleanup

**File:** `src/lib/db/focus.ts` - `startFocusSession()` function

### Before:
```typescript
const stale = await client.query<{ id: string | number }>(
  `update focus_sessions
      set ended_at = now(), end_reason = 'gave_up', duration_minutes = 0, focused_seconds = 0,
          paused_at = null, away_started_at = null
    where profile_id = $1 and ended_at is null
      and (room_id is null or started_at < now() - interval '24 hours')
      and (
        (paused_at is null
          and started_at < now()
              - make_interval(mins => target_duration_minutes + 15)
              - make_interval(secs => coalesce(total_paused_seconds, 0)))
        or paused_at < now() - interval '3 hours'
      )
    returning id`,
  [profileId],
);
```

### After:
```typescript
const stale = await client.query<{ id: string | number }>(
  `update focus_sessions
      set ended_at = now(), end_reason = 'gave_up', status = 'abandoned'::focus_session_status,
          duration_minutes = 0, focused_seconds = 0,
          paused_at = null, away_started_at = null
    where profile_id = $1 and ended_at is null
      and (room_id is null or started_at < now() - interval '24 hours')
      and (
        (paused_at is null
          and started_at < now()
              - make_interval(mins => target_duration_minutes + 15)
              - make_interval(secs => coalesce(total_paused_seconds, 0)))
        or paused_at < now() - interval '3 hours'
      )
    returning id`,
  [profileId],
);
```

**Changes:**
- ✅ Added `status = 'abandoned'::focus_session_status`

---

## 5. Update End Function Status Tracking

**File:** `src/lib/db/focus.ts` - `endFocusSession()` function

### Before:
```typescript
if (!focusSessionEffects(endReason).awardRewards || durationMinutes === 0) {
  await finalizeGardenEntries(profileId, sessionId, false, durationMinutes);
  if (session.rows[0].room_id) await clearGroupRoomPresence(Number(session.rows[0].room_id), profileId);
  return {
    session: mapFocus(updated.rows[0]),
    xpAwarded: 0,
    coinsAwarded: 0,
    questsUpdated: 0,
    streak: null,
    unlockedGroupAchievements: [],
  };
}
```

### After:
```typescript
if (!focusSessionEffects(endReason).awardRewards || durationMinutes === 0) {
  // Update status to reflect the end reason
  const statusMap: Record<FocusSessionEndReason, string> = {
    'completed': 'completed',
    'gave_up': 'gave_up',
  };
  await pool.query(
    `update focus_sessions set status = $3::focus_session_status where profile_id = $1 and id = $2`,
    [profileId, sessionId, statusMap[endReason] || 'gave_up'],
  );
  await finalizeGardenEntries(profileId, sessionId, false, durationMinutes);
  if (session.rows[0].room_id) await clearGroupRoomPresence(Number(session.rows[0].room_id), profileId);
  return {
    session: mapFocus(updated.rows[0]),
    xpAwarded: 0,
    coinsAwarded: 0,
    questsUpdated: 0,
    streak: null,
    unlockedGroupAchievements: [],
  };
}
```

**Changes:**
- ✅ Added status update based on end reason
- ✅ Maps `completed` and `gave_up` to appropriate status values

---

## 6. Fix Database Pool Singleton

**File:** `src/lib/db.ts`

### Before:
```typescript
if (process.env.NODE_ENV !== "production") {
  globalThis.energyosPgPool = pool;
}
```

### After:
```typescript
// Always store on globalThis to survive Next.js hot reload
globalThis.energyosPgPool = pool;
```

**Changes:**
- ✅ Removed NODE_ENV check
- ✅ Always store pool on globalThis in both dev and production
- ✅ Prevents connection leaks on hot reload

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| `migrations/2026-11-06-focus-session-status.sql` | Add status column + indexes | Enables session state tracking |
| `src/lib/db/recap.ts` | Use duration_minutes instead of time span | Fixes impossible recap numbers |
| `src/lib/db/focus.ts` | Mark cancelled sessions instead of deleting | Preserves audit trail |
| `src/lib/db/focus.ts` | Add status to stale session cleanup | Tracks abandoned sessions |
| `src/lib/db/focus.ts` | Add status update in end function | Proper state tracking |
| `src/lib/db.ts` | Always use globalThis pool | Prevents connection leaks |

---

## Testing Checklist

- [ ] Migration applies without errors
- [ ] Existing sessions backfilled with correct status
- [ ] New cancelled sessions have status = 'cancelled'
- [ ] Recap query returns correct totals
- [ ] 7 days × 4h = 1,680 minutes (28h)
- [ ] Cancelled session = 0 minutes
- [ ] No month exceeds 43,200 minutes
- [ ] Recap is idempotent
- [ ] Dashboard responds in < 1s
- [ ] No "[db] New client connected" spam on hot reload
