---
sessionId: session-261008-143346-ss10
---

# Weekly Planner — Recurring Items & Custom Modal

## Overview
Replace the cramped inline form in "Plano da semana" with a custom modal and add recurring planner items. Store recurring items as ONE series record and compute occurrences at read time. Existing one-time items keep working via read-time fallback.

## Goals
- Replace inline form with a centered modal (bottom sheet on mobile) matching the habit modal's look
- Add recurring items: "Só uma vez", "Toda semana" (weekday toggles), "A cada X semanas"
- Store series records with occurrence state keyed by seriesId + date
- Show "+N mais" for day cards with many items
- Add optional color and icon to planner items
- Server-side validation with generous safety limit (200 active items)
- Maintain backward compatibility: existing weekly_plans rows work with safe defaults

## Scope

**In Scope:**
- New `weekly_plan_series` table for recurring series records
- New `weekly_plan_occurrences` table for per-occurrence state (completed, skipped, overrides)
- `expandWeeklyPlanSeries()` function to compute occurrences for a given week
- `WeeklyPlanModal` component for create/edit with all fields
- Updated `WeeklyPlan` component with modal trigger, "+N mais", recurring indicators
- Updated types, API routes, and DB functions
- Server-side validation
- Empty state with "+" button on hover

**Out of Scope:**
- "Todo mês" recurrence (too complex, skipped)
- "Esta e as próximas" edit scope (implementing "Só esta" and "Todas" only)
- Drag and drop between day cards (not currently implemented)
- Real push notifications
- Modifying habits, Kanban, rewards, or other pages

## Technical Design

### Current Implementation

**Data Layer:**
- `weekly_plans` table: id, profile_id, plan_date, title, category_id, task_id, completed_at, start_time, end_time, all_day, created_at
- `listWeeklyPlans()` queries by weekStart date range
- `createWeeklyPlan()` inserts a single row
- `updateWeeklyPlan()` edits title, category, plan_date
- `deleteWeeklyPlan()` hard deletes

**UI Components:**
- `src/components/dashboard/weekly-plan.tsx` — inline form + week strip + edit modal
- `src/components/modal.tsx` — reusable modal with ESC, backdrop, focus trap
- `src/components/dashboard/color-palette.tsx` — 12 preset colors
- `src/components/dashboard/icon-picker.tsx` — icon picker (3 icons: paper, pencil, book)

**Types:**
- `WeeklyPlan` in `src/types/index.ts`: { id, profileId, planDate, title, categoryId, category, taskId?, completedAt?, startTime?, endTime?, allDay }

**API Routes:**
- `GET /api/weekly-plans?weekStart=` — list plans for a week
- `POST /api/weekly-plans` — create plan
- `PATCH /api/weekly-plans/:id` — toggle completion
- `PUT /api/weekly-plans/:id` — update title/category/date
- `DELETE /api/weekly-plans/:id` — delete plan

**Rewards:**
- `WEEKLY_PLAN_DONE_XP = 10`, `WEEKLY_PLAN_DONE_COINS = 10` in `lib/daily-limits.ts`
- `awardWeeklyPlanCompletion()` — idempotent via xp_ledger unique index

### Key Decisions

1. **Series-based model**: New `weekly_plan_series` table stores the recurrence rule. `weekly_plan_occurrences` stores per-date state. Old `weekly_plans` rows are treated as "once" series at read time via a union query, no migration needed.

2. **Occurrence expansion at read time**: `expandWeeklyPlanSeries()` computes which dates a series appears on for a given week, respecting the user's timezone. No background job needed.

3. **Backward compatibility**: Existing `weekly_plans` rows are read alongside series records. The UI shows both types uniformly. Old items appear as one-time occurrences.

4. **Edit/Delete scope**: "Só esta ocorrência" updates only the occurrence row. "Todas" updates/deletes the entire series. No "this and future" scope (too complex for v1).

5. **Color & Icon**: Optional fields on series records, reusing `HABIT_COLORS` and the 3-icon registry. If not set, fall back to category color and no icon.

6. **Safety limit**: 200 active series per user as a constant (`WEEKLY_PLAN_SERIES_LIMIT`).

### Proposed Changes

#### 1. Data Model Extension

**New table: `weekly_plan_series`**
- `id` serial PRIMARY KEY
- `profile_id` text NOT NULL (FK to profiles)
- `title` text NOT NULL
- `category_id` int NOT NULL (FK to categories)
- `icon_type` text DEFAULT 'asset' — 'asset' | 'emoji' | 'image' | null
- `icon_value` text DEFAULT null
- `color` text DEFAULT null — falls back to category color
- `note` text DEFAULT null
- `repeat_type` text NOT NULL DEFAULT 'once' — 'once' | 'weekly' | 'interval'
- `repeat_days` int[] DEFAULT null — [0-6] for Sun-Sat (JS weekday convention)
- `repeat_interval` int DEFAULT null — every N weeks (2-8) for 'interval'
- `start_time` time DEFAULT null — optional time of day
- `duration_minutes` int DEFAULT null — optional duration
- `start_date` date NOT NULL — first occurrence date
- `end_type` text DEFAULT 'never' — 'never' | 'date' | 'count'
- `end_date` date DEFAULT null
- `end_count` int DEFAULT null
- `timezone` text DEFAULT 'America/Sao_Paulo'
- `archived` boolean DEFAULT false
- `created_at` timestamptz DEFAULT now()

**New table: `weekly_plan_occurrences`**
- `id` serial PRIMARY KEY
- `series_id` int NOT NULL (FK to weekly_plan_series)
- `occurrence_date` date NOT NULL
- `completed_at` timestamptz DEFAULT null
- `skipped` boolean DEFAULT false
- `override_title` text DEFAULT null
- `override_start_time` time DEFAULT null
- UNIQUE (series_id, occurrence_date)

**Index:**
- `weekly_plan_series(profile_id, archived)`
- `weekly_plan_occurrences(series_id, occurrence_date)`

#### 2. Type Updates

Extend `src/types/index.ts`:
```typescript
export type PlanRepeatType = "once" | "weekly" | "interval";
export type PlanEndType = "never" | "date" | "count";

export interface WeeklyPlanSeries {
  id: number;
  profileId: string;
  title: string;
  categoryId: number;
  category: Category;
  iconType: "asset" | "emoji" | "image" | null;
  iconValue: string | null;
  color: string | null;
  note: string | null;
  repeatType: PlanRepeatType;
  repeatDays: number[] | null;
  repeatInterval: number | null;
  startTime: string | null;
  durationMinutes: number | null;
  startDate: string;
  endType: PlanEndType;
  endDate: string | null;
  endCount: number | null;
  timezone: string;
  archived: boolean;
  createdAt: string;
}

export interface WeeklyPlanOccurrence {
  id: number;
  seriesId: number;
  occurrenceDate: string;
  completedAt: string | null;
  skipped: boolean;
  overrideTitle: string | null;
  overrideStartTime: string | null;
}

// Unified type for the UI — combines old WeeklyPlan and new series occurrences
export interface WeeklyPlanItem {
  id: number; // occurrence id or old plan id
  seriesId: number | null; // null for old one-time plans
  planDate: string;
  title: string;
  categoryId: number;
  category: Category;
  iconType: "asset" | "emoji" | "image" | null;
  iconValue: string | null;
  color: string | null;
  note: string | null;
  completedAt: string | null;
  skipped: boolean;
  startTime: string | null;
  durationMinutes: number | null;
  repeatType: PlanRepeatType | null;
  repeatDays: number[] | null;
  isRecurring: boolean;
}
```

#### 3. DB Functions

**New functions in `src/lib/db/weekly-plans-series.ts`:**
- `ensureWeeklyPlanSeriesSchema()` — CREATE TABLE if not exists
- `listWeeklyPlanSeries(profileId)` — list all active series
- `createWeeklyPlanSeries(profileId, input)` — create new series with validation
- `updateWeeklyPlanSeries(profileId, seriesId, input)` — update series metadata
- `deleteWeeklyPlanSeries(profileId, seriesId)` — soft archive series
- `getWeeklyPlanSeries(profileId, seriesId)` — get single series
- `expandWeeklyPlanSeries(series, weekStart)` — compute occurrences for a week
- `setOccurrenceCompleted(profileId, seriesId, date, completed)` — toggle occurrence
- `skipOccurrence(profileId, seriesId, date)` — skip single occurrence
- `updateOccurrenceOverride(profileId, seriesId, date, overrides)` — edit single occurrence
- `listWeeklyPlanOccurrences(profileId, weekStart)` — unified list of all items (old + new)

**Updated functions in `src/lib/db/weekly-plans.ts`:**
- `listWeeklyPlans()` — deprecated, replaced by `listWeeklyPlanOccurrences()`
- Keep for backward compatibility but mark as deprecated

#### 4. API Route Updates

**New routes:**
- `GET /api/weekly-plans/series` — list all series
- `POST /api/weekly-plans/series` — create series
- `PATCH /api/weekly-plans/series/:id` — update series
- `DELETE /api/weekly-plans/series/:id` — archive series
- `PATCH /api/weekly-plans/series/:id/occurrence/:date` — toggle occurrence completion
- `PATCH /api/weekly-plans/series/:id/occurrence/:date/skip` — skip occurrence
- `PATCH /api/weekly-plans/series/:id/occurrence/:date/override` — edit single occurrence

**Updated routes:**
- `GET /api/weekly-plans?weekStart=` — return unified `WeeklyPlanItem[]` (old + new)

#### 5. UI Components

**`src/components/dashboard/weekly-plan-modal.tsx`** (new):
- Full create/edit modal reusing Modal component pattern
- Fields: title, repeat type (segmented control), weekday toggles, interval input, start date, end rule, time, duration, category, color, icon, note
- Live preview of chosen icon + color
- Form validation: title required, max 60 chars; weekdays required for weekly/interval
- Plain-language summary: "Repete todo domingo" or "Repete seg, qua e sex, a cada 2 semanas"

**`src/components/dashboard/weekly-plan.tsx`** (updated):
- Replace inline form with "+" button that opens WeeklyPlanModal
- Day cards show items with category color dot, icon, time, repeat indicator
- "+N mais" for cards with >4 items, opens day detail popover
- Clicking empty area of day card opens modal with that date pre-selected
- Empty state: "Nada planejado" with "+" on hover
- Edit pencil on each item opens modal pre-filled
- Check button for each occurrence

**`src/components/dashboard/weekly-plan-day-popover.tsx`** (new):
- Popover showing all items for a day when "+N mais" is clicked
- Each item has check, edit, and skip buttons

#### 6. Reward Logic

- Keep existing `awardWeeklyPlanCompletion()` for old one-time plans
- For new series occurrences, no XP/coins awarded (issue says "Do NOT give XP or coins for planner items unless that already exists")
- Since rewards already exist, apply the same once-per-item rule: award only on the old plan's completion, not on recurring occurrences

#### 7. Naming Updates

- "PLANO DA SEMANA" — keep as is
- "O que planejar..." — keep as is
- "Detalhes do plano" → "Editar plano"
- "Plano concluído" → keep as is
- Add "Nada planejado" for empty state
- Add "Criar plano" for empty state button

### File Structure

**Modified files:**
- `src/types/index.ts` — add WeeklyPlanSeries, WeeklyPlanOccurrence, WeeklyPlanItem types
- `src/lib/db/weekly-plans.ts` — add deprecation note, keep for backward compat
- `src/lib/daily-limits.ts` — add WEEKLY_PLAN_SERIES_LIMIT = 200
- `src/lib/api-client.ts` — add new API methods for series
- `src/app/api/weekly-plans/route.ts` — return unified items
- `src/app/api/weekly-plans/[id]/route.ts` — keep for backward compat
- `src/components/dashboard/weekly-plan.tsx` — major rewrite with modal trigger
- `src/app/dashboard/page.tsx` — update to use new API methods

**New files:**
- `src/lib/db/weekly-plans-series.ts` — DB functions for series model
- `src/app/api/weekly-plans/series/route.ts` — CRUD for series
- `src/app/api/weekly-plans/series/[id]/route.ts` — series detail + occurrences
- `src/components/dashboard/weekly-plan-modal.tsx` — create/edit modal
- `src/components/dashboard/weekly-plan-day-popover.tsx` — day detail popover
- `src/lib/weekly-plan-recurrence.test.ts` — tests for recurrence expansion

### Architecture Diagram

```mermaid
graph LR
  A[Dashboard: WeeklyPlan] --> B[API: /api/weekly-plans]
  B --> C[DB: weekly-plans-series.ts]
  C --> D[PostgreSQL: weekly_plan_series]
  C --> E[PostgreSQL: weekly_plan_occurrences]
  C --> F[DB: weekly-plans.ts (legacy)]
  F --> G[PostgreSQL: weekly_plans (legacy)]
  A --> H[WeeklyPlanModal]
  H --> I[ColorPalette]
  H --> J[IconPicker]
  A --> K[WeeklyPlanDayPopover]
```

### Risks
- **Schema migration**: New tables created via `ensureWeeklyPlanSeriesSchema()`. Old `weekly_plans` rows untouched — they continue to work via the legacy query path.
- **Occurrence expansion**: Must handle month/year boundaries and DST correctly. Using JS Date objects with the user's timezone.
- **Performance**: For a user with 200 series, expanding all for one week is ~200 * 7 = 1400 date checks. This is fast in SQL/JS.
- **Backward compatibility**: Old plans show alongside new series items. The unified `WeeklyPlanItem` type abstracts the difference.

# Testing

### Validation Approach
The project uses Node's built-in test runner with tsx (`npm test`). We'll add tests for the recurrence expansion logic following the same pattern as `garden-aggregation.test.ts`.

### Key Scenarios
1. **One-time item**: Shows only on its date, not on other days
2. **Weekly recurrence**: "Every Sunday" shows on Sunday of current week and next week
3. **Interval recurrence**: "Mon + Wed + Fri every 2 weeks" alternates correctly
4. **End date**: Series stops appearing after end date
5. **End count**: Series stops after N occurrences
6. **Occurrence completion**: Completing one Sunday doesn't complete the next
7. **Skip occurrence**: Skipped occurrence shows as skipped, doesn't affect other occurrences
8. **Edit scope**: "Só esta" edits only one occurrence; "Todas" edits the series
9. **Delete scope**: "Só esta" skips the occurrence; "Todas" archives the series
10. **Old items**: Existing weekly_plans rows show correctly alongside new series
11. **Max limit**: Creating more than 200 series is blocked
12. **Empty state**: No items shows "Nada planejado" with "+" button

### Edge Cases
- Series starts mid-week: only shows from start date forward
- Week crosses month boundary: occurrences computed correctly
- Week crosses year boundary: occurrences computed correctly
- DST change: dates computed in user's timezone, not affected by time shifts
- User creates series and immediately completes today's occurrence
- User edits series title — today's completion preserved
- 15 items in one day: card shows "+N mais" correctly

### Test Files
- `src/lib/weekly-plan-recurrence.test.ts` — tests for expandWeeklyPlanSeries()
- Run `npm run lint`, `npm run build` to verify type checking and build

# Delivery Steps

### ✓ Step 1: Extend data model and types
Add new tables, types, and DB functions for the series-based model.

- Create `src/lib/db/weekly-plans-series.ts` with:
  - `ensureWeeklyPlanSeriesSchema()` — CREATE TABLE IF NOT EXISTS for weekly_plan_series and weekly_plan_occurrences
  - `listWeeklyPlanSeries(profileId)` — list all active (non-archived) series
  - `createWeeklyPlanSeries(profileId, input)` — create new series with validation
  - `updateWeeklyPlanSeries(profileId, seriesId, input)` — update series metadata
  - `deleteWeeklyPlanSeries(profileId, seriesId)` — soft archive (set archived=true)
  - `getWeeklyPlanSeries(profileId, seriesId)` — get single series with ownership check
  - `expandWeeklyPlanSeries(series, weekStart)` — compute occurrences for a given week
  - `setOccurrenceCompleted(profileId, seriesId, date, completed)` — toggle occurrence completion
  - `skipOccurrence(profileId, seriesId, date)` — mark occurrence as skipped
  - `updateOccurrenceOverride(profileId, seriesId, date, overrides)` — edit single occurrence title/time
  - `listWeeklyPlanOccurrences(profileId, weekStart)` — unified list combining old weekly_plans + expanded series occurrences
- Add types to `src/types/index.ts`: PlanRepeatType, PlanEndType, WeeklyPlanSeries, WeeklyPlanOccurrence, WeeklyPlanItem
- Add `WEEKLY_PLAN_SERIES_LIMIT = 200` to `src/lib/daily-limits.ts`
- Update `src/lib/api-client.ts` with new methods for series CRUD and occurrence management
- Create API routes:
  - `src/app/api/weekly-plans/series/route.ts` — GET list, POST create
  - `src/app/api/weekly-plans/series/[id]/route.ts` — PATCH update, DELETE archive, PATCH occurrence endpoints
- Update `GET /api/weekly-plans?weekStart=` to return unified WeeklyPlanItem[]

### ✓ Step 2: Build weekly plan modal
Create the full create/edit modal with all fields.

- Create `src/components/dashboard/weekly-plan-modal.tsx`:
  - Reuse Modal component pattern (ESC, backdrop, focus trap, validation)
  - Fields: title (required, max 60 chars), repeat type segmented control, weekday toggles, interval input, start date, end rule, time, duration, category, color palette, icon picker, note
  - Live preview of chosen icon + color
  - Plain-language summary under repeat control
  - Form validation with error messages in Portuguese
  - Reuse glass-card/LED visual style from HabitModal
  - "Nova categoria" option for custom categories (reusing existing category creation flow)

### ✓ Step 3: Update weekly plan component
Rewrite the weekly plan component to use the modal and show recurring items.

- Rewrite `src/components/dashboard/weekly-plan.tsx`:
  - Replace inline form with "+" button that opens WeeklyPlanModal
  - Day cards show items with category color dot, icon (if any), time, repeat indicator icon
  - "+N mais" for cards with >4 items, opens WeeklyPlanDayPopover
  - Clicking empty area of day card opens modal with that date pre-selected
  - Empty state: "Nada planejado" with "+" on hover
  - Each item has check button and edit pencil
  - Edit modal shows scope dialog for recurring items: "Só esta ocorrência" or "Todas"
  - Delete shows scope dialog for recurring items
  - "Pular esta vez" option for recurring items
- Create `src/components/dashboard/weekly-plan-day-popover.tsx`:
  - Popover showing all items for a day
  - Each item has check, edit, and skip buttons
- Update `src/app/dashboard/page.tsx` to use new API methods and pass unified items

### ✓ Step 4: Add tests, validate, and finalize
Add tests for recurrence logic, run linter and build.

- Create `src/lib/weekly-plan-recurrence.test.ts`:
  - Test expandWeeklyPlanSeries() for once, weekly, and interval modes
  - Test end date and end count
  - Test week boundaries (month/year crossover)
  - Test timezone handling
- Run `npm run lint` and fix any issues
- Run `npm run build` to verify TypeScript compilation
- Run `npm test` to verify all tests pass
- Search for remaining mentions of old patterns and update them
- Verify the dashboard page works with both old and new plan types
- Summarize all changed files, new data fields, and any manual DB steps needed
