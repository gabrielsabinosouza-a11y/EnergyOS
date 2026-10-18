# Fix Monthly Recap ("Recap mensal") to Always Reflect Current Month

## Summary

This PR fixes the bug where the "Gerar recap" button was generating the recap for the PREVIOUS month instead of the current month. It also adds proper month finalization, new metrics, and timezone-aware date handling for America/Sao_Paulo.

## Root Cause

The bug was caused by PostgreSQL's `::timestamptz` cast interpreting date strings like "2026-10-01" as UTC midnight (00:00:00+00) instead of São Paulo midnight (03:00:00+00 UTC). This caused date range queries to include records from the wrong month.

For example:
- A focus session at September 30 23:30 São Paulo = October 1 02:30 UTC
- With the buggy UTC-based query, this session was counted in October instead of September

## Changes

### Backend (`src/lib/db/recap.ts`)
1. **Fixed timezone handling**: Added `spMonthStartIso()` and `spMonthEndIso()` functions to convert month boundaries to ISO timestamps with São Paulo timezone offset (UTC-3).
2. **Updated XP computation**: Modified `computeXpForMonth()` to use the new timezone-aware date functions.
3. **Updated `buildRecapSummary()`**: Now correctly passes ISO timestamps to all SQL queries for focus sessions, XP ledger, and other metrics.
4. **Added new metrics**: `coinsGained`, `coinsSpent`, `missionsCompleted`, `goalsCompleted`, `achievementsUnlocked`, `topFocusCategory`
5. **Fixed finalization logic**: Changed condition from `monthStart <= today` to `monthStart < currentMonth` to prevent premature finalization of the current month.

### Database Schema (`migrations/2026-10-19-recap-enhancements.sql`)
- Added columns for new metrics: `coins_gained`, `coins_spent`, `missions_completed`, `goals_completed`, `achievements_unlocked`, `top_focus_category`

### API (`src/app/api/recap/route.ts`)
- Added import for `todayIso` (was missing)
- Added support for optional `month` query parameter for generating specific past months

### API Client (`src/lib/api-client.ts`)
- Updated `generateRecap()` to accept optional `month` parameter

### Components
1. **`src/app/perfil/page.tsx`**: Updated to pass new metrics to `MonthlyRecapPremium`
2. **`src/components/dashboard/monthly-recap.tsx`**: Updated interface to include new metrics
3. **`src/components/dashboard/monthly-recap-premium.tsx`**: Updated to display new metrics and fixed status type from "parcial" to "live"
4. **`src/components/recap/recap-section.tsx`**: Updated to call API correctly with optional month parameter

### Types (`src/types/index.ts`)
- Updated `MonthlyRecap` interface with new metric fields

### Tests (`src/lib/db/recap.test.ts`)
- Tests already exist for month boundary logic
- Added verification tests for timezone handling

## Month Finalization

The finalization logic now works as follows:
1. **Current month (AO VIVO/live)**: Recaps for the current month are always computed from source data and can be updated at any time.
2. **Past months (FINAL)**: When viewing recaps, any non-final past month is automatically finalized with complete data.
3. **Idempotency**: Once a month is marked as FINAL, it cannot be overwritten by subsequent recap generations.

## Migration Instructions

After deploying this PR, run the backfill script to rebuild historical recap data:

```bash
node scripts/backfill-recaps.mjs
```

This will regenerate August and September 2026 with correct timezone-aware data and mark them as FINAL.

## Testing

1. **Month boundary tests**: Verify that events at 23:30 São Paulo on Sept 30 are counted in September, and events at 00:10 São Paulo on Oct 1 are counted in October.
2. **Current month generation**: Verify that "Gerar recap" on any day in October generates October recap (not September).
3. **Finalization**: Verify that viewing recaps in November shows September as FINAL.

## Breaking Changes

- Status values changed from "parcial" to "live" for current months
- The `generateRecap()` API client method signature changed (removed year/month parameters, server now decides)

## Files Changed

- `src/lib/db/recap.ts` (major changes)
- `src/app/api/recap/route.ts` (minor additions)
- `src/lib/api-client.ts` (signature change)
- `src/types/index.ts` (new fields)
- `src/app/perfil/page.tsx` (new metric props)
- `src/components/dashboard/monthly-recap.tsx` (new metric props)
- `src/components/dashboard/monthly-recap-premium.tsx` (type fix, new metrics)
- `src/components/recap/recap-section.tsx` (API call fixes)
- `migrations/2026-10-19-recap-enhancements.sql` (new migration)
- `scripts/backfill-recaps.mjs` (new script)