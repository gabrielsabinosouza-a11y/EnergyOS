---
sessionId: session-261008-143346-ss10
---

# Requirements

### Overview
Rename the dashboard section "Tarefas diárias" to "Habits" and transform it into a fully customizable habits system shared with the Consistência page. Each habit can have a custom icon (app icon, emoji, or uploaded image), color, frequency schedule, and goal type (simple check or measurable target).

### Goals
- Rename all UI references from "Tarefas diárias" to "Habits" (keeping Portuguese context where appropriate)
- Extend the data model with icon, color, frequency, goal type, and metadata fields
- Build a create/edit modal with icon picker, color palette, frequency toggles, and goal type
- Add drag-and-drop reordering with @dnd-kit (already installed)
- Raise the habit limit from 3 to 10
- Ensure rewards are awarded once per habit per day (anti-abuse)
- Maintain backward compatibility: existing habits keep working with safe defaults
- Keep the Consistência page and dashboard reading the same source of truth

### User Stories
- As a user, I want to create habits with custom icons and colors so my dashboard feels personal
- As a user, I want to schedule habits for specific days so I don't see weekend gym habits on Monday
- As a user, I want to track measurable goals (e.g., "3 liters of water") not just yes/no checkboxes
- As a user, I want to reorder my habits so the most important ones appear first
- As a user, I want to archive habits without losing my streak history

### Scope

**In Scope:**
- Rename "Tarefas diárias" → "Habits" across dashboard, Consistência page, modals, empty states, toasts
- Extend `profile_daily_tasks` table with new columns (icon, color, frequency, goal type, etc.)
- Create/edit modal with icon picker (curated ~30 app icons + emoji + upload), color palette, frequency, goal type
- Drag-and-drop reordering via @dnd-kit
- Measurable goal type with progress logging
- Archive/delete with history preservation
- Anti-abuse: max 10 habits, rewards once per habit per day
- Consistência page shows habit icons and colors
- Progress bar counts only habits scheduled for today
- Server-side validation
- Empty state with "Criar primeiro hábito" button
- Responsive, keyboard accessible, respects prefers-reduced-motion
- Tests for frequency and reward logic

**Out of Scope:**
- Real push notifications (reminderTime stored but disabled with "em breve" label)
- Renaming database collection names (profile_daily_tasks stays as-is)
- Modifying the separate `habits` table (tied to goals, unrelated)

# Technical Design

### Current Implementation

**Data Layer:**
- `profile_daily_tasks` table: id, profile_id, title, is_active, sort_order, created_at
- `daily_task_log` table: task_id (FK), log_date, is_completed, completed_at
- Schema auto-created via `ensureDailyTasksSchema()` in `src/lib/db/daily-tasks.ts`

**API Routes:**
- `GET /api/daily-tasks` — list today's tasks
- `POST /api/daily-tasks` — create task
- `PATCH /api/daily-tasks/:id` — toggle completion or update title
- `DELETE /api/daily-tasks/:id` — soft-archive (sets is_active=false)
- `GET /api/daily-tasks/history?from=&to=` — history for Consistência

**UI Components:**
- `src/components/dashboard/recurring-daily-tasks.tsx` — dashboard widget ("TAREFAS DIÁRIAS")
- `src/components/dashboard/habit-tracker.tsx` — Consistência page tracker ("Minhas tarefas diárias")
- `src/components/dashboard/habit-card.tsx` — individual habit card with heatmap
- `src/components/modal.tsx` — reusable modal with ESC, backdrop, focus trap
- `src/components/reward-toast.tsx` — coin reward toast

**Types:**
- `UserDailyTask` in `src/types/index.ts`: { id, title, taskDate, isCompleted, completedAt }

**Rewards:**
- Constants in `src/lib/daily-limits.ts`: DAILY_TASK_LIMIT=3, DAILY_TASK_XP=10, DAILY_TASK_COINS=5, DAILY_TASK_ALL_BONUS_COINS=10
- Rewards awarded in `toggleDailyTask()` in `src/lib/db/daily-tasks.ts` (once per completion, idempotent via `alreadyDone` check)

**Upload:**
- Cloudinary configured in `src/lib/media.ts` (uploadToCloudinary function)
- Environment: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

**Drag-and-drop:**
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities already installed

### Key Decisions

1. **Read-time defaults for migration**: New columns added with PostgreSQL DEFAULT values. Existing rows automatically get defaults when read — no data migration script needed.

2. **Curated icon subset (~30 icons)**: Select habit-relevant icons from `src/icons_8bits/` organized by category (study, workout, sleep, food, reading, focus, water, etc.) rather than exposing all 150+ icons.

3. **@dnd-kit for reordering**: Already installed. Using @dnd-kit/sortable with keyboard-accessible alternative (up/down buttons).

4. **Rename constants**: DAILY_TASK_* → HABIT_* in `src/lib/daily-limits.ts` for clarity, with the limit raised to 10.

5. **Frequency types**: "daily" (default), "weekdays" (specific Mon-Sun toggles), "times_per_week" (X times per week). Habits not scheduled for today don't appear as pending and don't break streaks.

6. **Goal types**: "check" (done/not done, default) and "measurable" (numeric target + unit, e.g., "3 liters"). For measurable, user logs progress; habit counts complete when target is reached.

7. **Anti-abuse**: Rewards awarded only once per habit per day. The existing `alreadyDone` check in `toggleDailyTask()` already prevents re-awarding. Editing metadata never resets completion.

### Proposed Changes

#### 1. Data Model Extension
Add columns to `profile_daily_tasks`:
- `icon_type` text DEFAULT 'asset' — 'asset' | 'emoji' | 'image'
- `icon_value` text DEFAULT 'target' — asset filename, emoji string, or Cloudinary URL
- `color` text DEFAULT '#71d4ff' — hex color for icon background/checkbox/progress
- `frequency_type` text DEFAULT 'daily' — 'daily' | 'weekdays' | 'times_per_week'
- `frequency_days` int[] DEFAULT NULL — [1,2,3,4,5,6,0] for Mon-Sun (0=Sunday)
- `frequency_target` int DEFAULT NULL — target times per week for 'times_per_week'
- `goal_type` text DEFAULT 'check' — 'check' | 'measurable'
- `target_value` numeric DEFAULT NULL — numeric target for measurable goals
- `unit` text DEFAULT NULL — unit string (e.g., 'liters', 'hours', 'minutes')
- `current_progress` numeric DEFAULT 0 — current progress toward target
- `description` text DEFAULT NULL — optional note
- `category` text DEFAULT NULL — optional category/tag
- `start_date` date DEFAULT NULL — optional start date
- `reminder_time` time DEFAULT NULL — stored but disabled ("em breve")
- `archived` boolean DEFAULT false — soft-archive flag (separate from is_active)

Update `daily_task_log` to support measurable progress:
- Add `progress_value` numeric DEFAULT NULL — logged progress for measurable habits

#### 2. Type Updates
Extend `UserDailyTask` in `src/types/index.ts` with new fields. Add `HabitIconType`, `HabitFrequencyType`, `HabitGoalType` types.

#### 3. API Route Updates
- `POST /api/daily-tasks` — accept full habit payload (name, icon, color, frequency, goal type, etc.)
- `PATCH /api/daily-tasks/:id` — support updating all fields, not just title/completion
- `POST /api/daily-tasks/:id/progress` — log progress for measurable habits
- `PATCH /api/daily-tasks/:id/order` — update sort_order for reordering
- `GET /api/daily-tasks` — return only habits scheduled for today (respecting frequency)
- Add `GET /api/daily-tasks?all=true` — return all active habits (for Consistência page)

#### 4. UI Components
- **HabitCreateEditModal** (new): Full modal with tabs for icon picker, color palette, frequency toggles, goal type selector, and metadata fields
- **IconPicker** (new): Three tabs — "Ícones do app" (curated icons), "Emoji" (emoji grid), "Imagem" (upload with preview)
- **ColorPalette** (new): Small palette of ~12 preset colors
- **FrequencySelector** (new): Radio for daily/weekdays/times_per_week + weekday toggles or number input
- **HabitRow** (new): Replaces current task row with icon, name, progress indicator, checkbox, and menu (edit/archive/delete)
- **HabitMenu** (new): Dropdown with edit, archive, delete options
- Update `HabitCard` to use habit's chosen icon and color instead of computed defaults
- Update `RecurringDailyTasks` to use new components and naming
- Update `HabitTracker` to use new data model

#### 5. Reward Logic
- Rename constants: DAILY_TASK_LIMIT → HABIT_LIMIT (10), DAILY_TASK_XP → HABIT_XP, etc.
- Keep existing idempotent reward logic (alreadyDone check)
- Add server-side validation: max 10 active habits, name length ≤ 40 chars, allowed icon types
- Progress bar counts only habits scheduled for today

#### 6. Naming Updates
- "TAREFAS DIÁRIAS" → "HÁBITOS" in dashboard
- "Minhas tarefas diárias" → "Meus hábitos" in Consistência
- "Tarefas diárias feitas" → "Hábitos completados" in Consistência stats
- "Criar tarefa diária" → "Criar primeiro hábito" in empty state
- "repetem todo dia" badge → removed (frequency is now customizable)
- Modal titles: "Nova tarefa diária" → "Novo hábito", "Editar tarefa" → "Editar hábito"

### File Structure

**Modified files:**
- `src/lib/daily-limits.ts` — rename constants, raise limit to 10
- `src/lib/db/daily-tasks.ts` — extend schema, add new DB functions
- `src/types/index.ts` — extend UserDailyTask type
- `src/lib/api-client.ts` — add new API methods
- `src/app/api/daily-tasks/route.ts` — accept full habit payload
- `src/app/api/daily-tasks/[id]/route.ts` — support full updates
- `src/components/dashboard/recurring-daily-tasks.tsx` — rename, use new components
- `src/components/dashboard/habit-tracker.tsx` — use new data model
- `src/components/dashboard/habit-card.tsx` — use habit icon/color
- `src/app/dashboard/consistencia/page.tsx` — update naming
- `src/lib/daily-task-actions.ts` — update if needed
- `src/lib/use-activity-history.ts` — update naming
- `src/components/dashboard/heatmap.tsx` — update naming

**New files:**
- `src/components/dashboard/habit-modal.tsx` — create/edit modal
- `src/components/dashboard/icon-picker.tsx` — icon picker with tabs
- `src/components/dashboard/color-palette.tsx` — color palette
- `src/components/dashboard/frequency-selector.tsx` — frequency selector
- `src/components/dashboard/habit-row.tsx` — habit row with icon, progress, menu
- `src/components/dashboard/habit-menu.tsx` — context menu
- `src/lib/db/habit-validation.ts` — server-side validation helpers
- `src/lib/habit-icons.ts` — curated icon list with categories
- `src/lib/habit-frequency.test.ts` — tests for frequency logic
- `src/lib/habit-rewards.test.ts` — tests for reward logic

### Architecture Diagram

``` mermaid
graph LR
  A[Dashboard: RecurringDailyTasks] --> B[API: /api/daily-tasks]
  C[Consistência: HabitTracker] --> B
  B --> D[DB: daily-tasks.ts]
  D --> E[PostgreSQL: profile_daily_tasks]
  D --> F[PostgreSQL: daily_task_log]
  A --> G[HabitCreateEditModal]
  G --> H[IconPicker]
  G --> I[ColorPalette]
  G --> J[FrequencySelector]
  H --> K[Cloudinary upload]
  A --> L[dnd-kit: drag reorder]
  L --> B
```

### Risks
- **Schema migration**: Adding columns with DEFAULT values is safe but requires the DB connection. The `ensureDailyTasksSchema()` function already handles ALTER TABLE, so new columns will be added on first request.
- **Icon asset loading**: 30 icons loaded via next/image — need to ensure they're properly imported from src/icons_8bits/.
- **Cloudinary upload**: File size limit (2MB) and type validation (png/jpg/webp) must be enforced on both client and server.
- **Backward compatibility**: Old habits without icon/color will show defaults. The read-time fallback ensures no broken UI.
- **Drag-and-drop on mobile**: @dnd-kit supports touch, but need to test on small screens.

# Testing

### Validation Approach
The project uses Node's built-in test runner with tsx (`npm test`). Tests exist for activity and dates logic. We'll add tests for the new frequency and reward logic following the same pattern.

### Key Scenarios
1. **Create habits with each icon type**: App icon, emoji, uploaded image — verify persistence after reload
2. **Edit habit metadata**: Change name, icon, color — verify today's completion is preserved and no rewards are re-awarded
3. **Frequency scheduling**: Weekday-only habit doesn't appear as pending on weekends; doesn't break streak
4. **Measurable goals**: Log progress, verify completion when target is reached
5. **Rewards**: Complete, uncheck, recheck — rewards given once per day
6. **Max limit**: Creating more than 10 is blocked with clear message
7. **Archive/Delete**: Archived habits hidden from today's list but history preserved on Consistência
8. **Drag-and-drop**: Reorder habits, verify order persists after reload
9. **Old habits**: Existing habits created before migration load correctly with defaults

### Edge Cases
- User creates a habit and immediately completes it — reward awarded correctly
- User unchecks and rechecks the same habit — no double reward
- User edits a habit's name — completion state preserved
- Habit scheduled for weekdays only on a Saturday — not shown as pending, streak unaffected
- Measurable habit: user logs 1.5L then 1.5L of a 3L target — completes correctly
- Upload fails (network error) — habit creation rolls back, error toast shown
- Empty state: no habits — "Criar primeiro hábito" button works
- prefers-reduced-motion: animations disabled

### Test Files
- `src/lib/habit-frequency.test.ts` — tests for isHabitScheduledToday(), frequency validation
- `src/lib/habit-rewards.test.ts` — tests for reward idempotency, max limit enforcement
- Run `npm run lint`, `npm run build` to verify type checking and build

# Delivery Steps

### ✓ Step 1: Extend data model and API
Add new columns to profile_daily_tasks and daily_task_log, extend types, and update API routes to support the full habit payload.

- Add columns to `profile_daily_tasks`: icon_type, icon_value, color, frequency_type, frequency_days, frequency_target, goal_type, target_value, unit, current_progress, description, category, start_date, reminder_time, archived (all with safe DEFAULT values)
- Add `progress_value` column to `daily_task_log`
- Update `ensureDailyTasksSchema()` in `src/lib/db/daily-tasks.ts` to create these columns
- Extend `UserDailyTask` type in `src/types/index.ts` with new fields
- Add `HabitIconType`, `HabitFrequencyType`, `HabitGoalType` types
- Rename constants in `src/lib/daily-limits.ts`: DAILY_TASK_* → HABIT_*, raise limit to 10
- Update `createDailyTask()` to accept full habit payload with validation
- Add `updateHabitMetadata()` for editing icon, color, frequency, goal type
- Add `logHabitProgress()` for measurable habit progress logging
- Add `reorderHabits()` for updating sort_order
- Update API routes: POST accepts full payload, PATCH supports all fields, add POST /progress and PATCH /order endpoints
- Update `listDailyTasks()` to filter by frequency (only return habits scheduled for today)
- Add `getAllHabits()` for Consistência page (returns all active habits regardless of today's schedule)
- Update `src/lib/api-client.ts` with new methods
- Create `src/lib/db/habit-validation.ts` with server-side validation helpers
- Create `src/lib/habit-icons.ts` with curated icon list (~30 icons, categorized)
- Update naming in `src/lib/use-activity-history.ts` and `src/components/dashboard/heatmap.tsx`

### ✓ Step 2: Build habit create/edit modal and pickers
Create the full habit creation and editing modal with icon picker, color palette, frequency selector, and goal type.

- Create `src/components/dashboard/habit-modal.tsx`: Create/edit modal reusing the existing Modal component pattern (ESC, backdrop, focus trap, validation)
- Create `src/components/dashboard/icon-picker.tsx`: Three tabs — "Ícones do app" (curated icons from habit-icons.ts, displayed with next/image), "Emoji" (grid of common emojis), "Imagem" (file upload using uploadToCloudinary from lib/media.ts, with type/size validation and square crop preview)
- Create `src/components/dashboard/color-palette.tsx`: ~12 preset colors with preview
- Create `src/components/dashboard/frequency-selector.tsx`: Radio buttons for daily/weekdays/times_per_week, weekday toggles (Seg-Dom), number input for times_per_week
- Add goal type selector: simple check vs measurable (with target value and unit inputs)
- Add optional fields: description, category, start date, reminder time (disabled with "em breve" label)
- Live preview of chosen icon + color next to habit name
- Form validation: name required, max 40 chars; icon required; color required
- Reuse the glass-card/LED visual style from EditDailyTaskModal

### ✓ Step 3: Update dashboard and Consistência UI
Rename all UI references, update the dashboard widget and Consistência tracker to use the new habit model, and add drag-and-drop reordering.

- Rename "TAREFAS DIÁRIAS" → "HÁBITOS" in `src/components/dashboard/recurring-daily-tasks.tsx`
- Update description text to talk about habits (reading reward values from HABIT_* constants)
- Remove "repetem todo dia" badge (frequency is now customizable)
- Replace inline task form with "+" button that opens HabitCreateEditModal
- Create `src/components/dashboard/habit-row.tsx`: Row with icon, name, progress indicator (for measurable), checkbox, and menu button
- Create `src/components/dashboard/habit-menu.tsx`: Dropdown with edit, archive, delete (with confirmation)
- Add @dnd-kit drag-and-drop to the habit list (SortableContext, useSortable) with keyboard-accessible up/down buttons as alternative
- Update empty state: "Nenhum hábito ainda" + "Criar primeiro hábito" button
- Update HabitCard in `src/components/dashboard/habit-card.tsx` to use habit's chosen icon and color instead of computed defaults
- Update HabitTracker in `src/components/dashboard/habit-tracker.tsx`: rename "Minhas tarefas diárias" → "Meus hábitos", use new data model
- Update Consistência page: "Tarefas diárias feitas" → "Hábitos completados"
- Progress bar counts only habits scheduled for today
- Show habit count as "N/10" in the create form
- Add completion animation (transform/opacity only) respecting prefers-reduced-motion
- Ensure loading and error states show toasts in Portuguese

### ✓ Step 4: Add tests, validate, and finalize
Add tests for frequency and reward logic, run linter and build, verify all naming is consistent.

- Create `src/lib/habit-frequency.test.ts`: Test isHabitScheduledToday() for daily, weekdays, and times_per_week modes
- Create `src/lib/habit-rewards.test.ts`: Test reward idempotency (once per habit per day), max limit enforcement (10 habits), and that editing metadata never resets completion
- Run `npm run lint` and fix any issues
- Run `npm run build` to verify TypeScript compilation
- Run `npm test` to verify all tests pass
- Search the entire project for remaining mentions of "Tarefas diárias", "TAREFAS DIÁRIAS", "tarefas diárias", "daily task" in UI strings and update them
- Verify the sidebar navigation ("Consistência") is unchanged
- Verify the reward-toast component works with new reward values
- Summarize all changed files, new data fields, and any manual DB steps needed