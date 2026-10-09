# EnergyOS — Full Website Analysis for Claude

> **Purpose:** This document is a comprehensive, ground-up analysis of the entire EnergyOS codebase. It is written for Claude to read and act on — every section contains file/line references, current code state, and precise next steps.
>
> **Last reviewed against code:** 2026-10-09
> **Build status:** `tsc --noEmit` ✅ · `eslint` ✅ · `npm test` ✅ (36/36 pass)
> **Project path:** `/run/media/gabriel/ExternalHDD/Projects/EnergyOS`

---

## 1. Project Overview

**EnergyOS** is a gamified personal productivity & wellness dashboard built on Next.js 16 (App Router + React 19 + TypeScript). The core loop is: daily check-in → streak tracking → XP/coin rewards → daily quests → achievements → store purchases → garden visualization. It has a social layer (friends/DM, groups, focus rooms) and a league system.

| Layer | Tech |
|---|---|
| Frontend | Next.js 16.3.2, React 19.2.8, TypeScript (strict), Tailwind CSS v4, Framer Motion, Recharts, lucide-react, three.js (landing 3D), dnd-kit |
| Backend | Next.js API Routes (116 route files), raw SQL via `pg` connection pool |
| Auth | Firebase Authentication (email/password + Google OAuth), server-side token verification via Identity Toolkit |
| Database | PostgreSQL (Neon cloud-hosted), raw SQL, no ORM |
| Assets | Cloudinary (configured), Firebase Storage (available) |
| Email | Resend (configured, unused in code) |
| Analytics | Google Analytics 4 (`NEXT_PUBLIC_GA_MEASUREMENT_ID` configured in `.env`) |
| PWA | Service worker (`src/lib/sw-register.ts`), web manifest (`src/app/manifest.ts`) |
| Deployment | Vercel (implied by `.env`, `setup-vercel-env.sh`, `@supabase` deps) |

**Total source files:** ~303 `.ts`/`.tsx` files in `src/`
**Total db modules:** 37 files in `src/lib/db/`
**Total API routes:** 116 `route.ts` files in `src/app/api/`

### Key directories

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Login + cadastro (email/password, Google OAuth)
│   │   ├── login/page.tsx
│   │   ├── cadastro/page.tsx
│   │   └── auth/action/page.tsx   # Password reset, email verification callbacks
│   ├── auth/callback/page.tsx     # OAuth redirect handler
│   ├── api/                  # 116 API route files (all backend logic)
│   │   ├── checkins/        # Daily wellness check-in (sleep/study/training/energy)
│   │   ├── tasks/           # Task CRUD + completion + streak
│   │   ├── goals/           # Goals CRUD
│   │   ├── habits/          # Habits CRUD
│   │   ├── daily-tasks/     # User-written daily habit tracker
│   │   ├── daily-quests/    # Daily mission system
│   │   ├── kanban/          # Kanban board CRUD
│   │   ├── weekly-plans/    # Recurring weekly planner
│   │   ├── focus/           # Individual focus timer
│   │   ├── focus-rooms/     # Collaborative focus rooms (25 routes)
│   │   ├── groups/          # Social groups with chat (20+ routes)
│   │   ├── friends/         # Friend requests
│   │   ├── dm/              # Direct messages
│   │   ├── social/          # User search, unread counts, public profiles
│   │   ├── league/          # OLD league system (legacy)
│   │   ├── league-new/      # NEW league system (active)
│   │   ├── achievements/    # Achievement progress, claiming, featuring
│   │   ├── store/           # Coins, auras, decorations, shields, XP boosts (10 routes)
│   │   ├── garden/          # Garden visualization
│   │   ├── profile/         # User profile
│   │   ├── settings/        # User settings
│   │   ├── insights/        # Weekly insights
│   │   ├── recap/           # Monthly recap
│   │   ├── dashboard/       # Dashboard snapshot
│   │   ├── streak-calendar/ # Streak calendar
│   │   ├── relatorio/       # Reports (charts data)
│   │   ├── categories/      # Shared category system
│   │   ├── goal-logs/       # Goal progress logs
│   │   ├── env-status/      # Diagnostics (admin-only)
│   │   ├── test/            # Diagnostics (404 in production)
│   │   └── dev/groups/      # Dev-only simulation endpoint
│   ├── dashboard/
│   │   └── consistencia/    # Consistency heatmap page
│   ├── amigos/page.tsx      # Friends + DM page
│   ├── grupos/page.tsx      # Groups page (1900+ lines)
│   ├── salas-de-foco/page.tsx # Focus rooms page (1800+ lines)
│   ├── liga/page.tsx        # League page
│   ├── loja/page.tsx        # Store page
│   ├── jardim/page.tsx      # Garden page
│   ├── perfil/page.tsx      # Profile page
│   ├── relatorio/page.tsx   # Reports page (Recharts)
│   ├── configuracoes/page.tsx # Settings page
│   ├── landing-page.tsx     # Landing page (3D scene)
│   ├── layout.tsx           # Root layout (fonts, theme, auth, metadata)
│   ├── globals.css          # Design system (CSS custom properties)
│   ├── landing.css
│   └── manifest.ts
├── components/               # 50+ React components (dashboard, landing, chat, etc.)
├── lib/                      # Core libraries
│   ├── db/                   # 37 database operation modules (14k+ lines total)
│   ├── auth-context.tsx      # Firebase auth React context + redirect hooks
│   ├── server-auth.ts        # Token verification (Identity Toolkit)
│   ├── api-client.ts         # Frontend fetch wrapper (502 lines, typed)
│   ├── http.ts               # Error handling (handleRoute, readJsonBody, jsonOk/jsonError)
│   ├── errors.ts             # AppError hierarchy (Unauthorized, NotFound, Forbidden, etc.)
│   ├── route-access.ts       # Protected/guest-only route definitions
│   ├── middleware.ts         # Server-side route protection (cookie-based)
│   ├── firebase.ts           # Firebase client config
│   ├── theme-provider.tsx    # Light/dark/system theme
│   ├── sw-register.ts        # PWA service worker registration
│   ├── reminders.ts          # Local notification scheduler
│   ├── session-alerts.ts     # Sound/title flash notifications
├── types/
│   ├── index.ts              # 888 lines — all TypeScript interfaces
│   └── domain.ts             # 108 lines — v2 domain model (Habit/Goal/Planner)
├── db-schema.sql             # PostgreSQL schema (102 lines, extended via migrations)
└── icons_8bits/              # ~200 app icons for habits
```

---

## 2. What Works Well (Confirmed)

### Architecture
- **Server-side route protection** via `middleware.ts` (cookie-based `energyos_session`). Redirects unauthenticated users from protected routes to `/`; redirects authenticated users from `/login`/`/cadastro` to `/dashboard`. (Note: the `PROJECT_STATUS.md` from August claimed this was missing — it was added later.)
- **Mobile navigation** is implemented: `AppShell` renders a bottom tab bar (`PRIMARY_TABS`) + "Mais" bottom sheet (`MORE_TABS`) for screens < `lg:`, and the desktop sidebar for larger screens. (`PROJECT_STATUS.md` claimed mobile nav was missing.)
- **Rate limiting** on all abuse-prone endpoints via `src/lib/rate-limit.ts` (in-memory, 429 on exceed).
- **All API routes use parameterized SQL** with `parseProfileId` for server-side profile resolution (never client-supplied).
- **`handleRoute` wrapper** used by 116 routes (68 routes use their own try/catch pattern instead — see §5.3).
- **`readJsonBody`** throws `BadRequestError` so malformed/null/array bodies return 400, not 500.
- **Security headers** in `next.config.ts`: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- **PWA**: service worker registration, web manifest, installable.
- **36 automated tests** pass (dates, streaks, focus rewards, habits, garden aggregation, weekly plans).

### Security (Verified per `SECURITY_AUDIT.md`)
- All 7 critical exploits fixed (focus XP farming, daily-quest cheat, check-in backdating, store race conditions, XP ledger double rewards, etc.)
- All 5 high-severity issues fixed (security headers, env-status hardening, debug endpoint gated, rate limiting, email verification check in code)
- `xp_ledger` unique index + idempotent `creditXP`
- Password reset flow with Firebase action URL handling (`/auth/action` page)
- `console.log` PII removed from most routes

### UX
- Achievement unlock celebration modal with queueing (one at a time)
- Optimistic message sending in chat
- Auto-scroll to bottom on chat open
- Onboarding tour with icons
- Focus room invite system with join requests
- Streak shields for protection
- XP boost potions (2x for 60 min)
- Garden visualization with energy-type plants
- Monthly recap with premium share

---

## 3. Build / Lint / Test Status

| Check | Command | Status | Notes |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ Passes | No type errors |
| ESLint | `npx eslint src/` | ✅ Passes | No errors or warnings |
| Tests | `npm test` | ✅ 36/36 pass | Node's built-in test runner |
| Build | `npm run build` | ⚠️ Untested | Should be verified before launch (see §5.10) |

**Test files (8):**
- `src/lib/db/dates.test.ts` — timezone/date logic
- `src/lib/db/focus-rewards.test.ts` — XP ledger source validation
- `src/lib/activity.test.ts` — activity tracking
- `src/lib/consistency-calendar.test.ts` — consistency calendar
- `src/lib/habit-icons.test.ts` — habit icon assets
- `src/lib/habit-schedule.test.ts` — habit scheduling
- `src/lib/daily-habit-progress.test.ts` — daily habit progress
- `src/lib/garden-aggregation.test.ts` — garden aggregation
- `src/lib/weekly-plan-recurrence.test.ts` — weekly plan recurrence

**Test gaps:** No tests for API routes, no end-to-end tests, no component tests. The debugging guide (`DEBUGGING_GUIDE.md`) only has manual checklists.

---

## 4. Issues Still Open (From STATUS.md — Verified in Current Code)

### Known Bugs (B-list)

| ID | Severity | Description | Status | Evidence |
|---|---|---|---|---|
| **B1** | Low | Check-in button/sleep answer resets to "Salvar check-in" after reload even when already checked in. Data persists; UI state is client-only. | **OPEN** | `dashboard/page.tsx:112-114` — `checkinSaved` and `sleepAnswer` are `useState(false)` / `useState("7 a 8 horas")` defaults. The snapshot's `todays.sleepHours` is used to derive `sleepAnswer` (line 206-207) but `checkinSaved` is NEVER re-derived from the snapshot. Fix: check `snapshot.checkins` for today's entry and set `checkinSaved = true` on load. |
| **B2** | Medium | Amigos DM may not recognize your own messages. | **SUSPECTED/FIXED** | `amigos/page.tsx:110-118` now uses `myProfileId` (resolved via `api.getProfile()`) and gates ChatThread rendering on `profileIdReady`. `ChatThread.tsx:1024,1159` computes `isMe = msg.senderId === currentUserId`. Since `senderId` is stored as the hashed UUID profile ID server-side, and `currentUserId` is now the same normalized form, this should work. **Needs runtime verification on two devices.** |
| **B3** | Low | Group chat whitespace below input bar on mobile (reported 3×). | **OPEN** | `grupos/page.tsx:811` — the chat container uses `h-[calc(100dvh-126px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]` which may not account for the mobile keyboard viewport. |
| **B4** | Medium | Focus room pause/resume race (stale state between users). | **PARTIALLY FIXED** | `src/lib/db/focus-rooms.ts:677` — `pauseFocusRoom` now uses a transaction with `SELECT ... FOR UPDATE` row lock. `resumeFocusRoom` (line 734) uses the same pattern. **But**: the **client-side UI** may still display stale state if other participants pause/resume without a UI refresh. No WebSocket/real-time subscription exists — the client polls every 4s (`POLL_INTERVAL_MS = 4000` at `salas-de-foco/page.tsx:59`). This is a UX gap, not a data-integrity bug. |
| **B5** | High | Focus room join-by-code broken for new (non-member) users. | **OPEN** | `src/lib/db/focus-rooms.ts:285` — `createJoinRequest()` checks `[waiting, active, paused]` status. But `getFocusRoomByCode` (`focus-rooms.ts:383`) throws `ForbiddenError` for non-host/non-participants. The `joinFocusRoom` API client method sends a POST to `/api/focus-rooms/{code}/join` — **but** the route is registered as `/api/focus-rooms/[roomId]/join/route.ts`, which expects a numeric roomId, not a code. The `api.getFocusRoomByCode` uses `/api/focus-rooms/${code}` which also hits `[roomId]` — there is **no dedicated route for joining by string code**. |
| **B6** | Low | Focus room "leave while waiting" route is flawed. | **WORKAROUNDED** | `salas-de-foco/page.tsx:767-784` — `handleLeaveRoom` checks `currentRoom.status === "active" || "paused"` and calls `giveUpFocusRoom` instead. For "waiting" status it calls `leaveFocusRoom`. This works but the `leaveFocusRoom` API path (`/api/focus-rooms/{id}/leave`) removes the participant — if the room is "waiting" the host may still start it for other participants. |
| **B7** | Medium | Achievement reward mint not in a transaction with per-tier grant. | **OPEN** | `src/lib/db/achievements.ts:82-119` — `awardAchievementRewards` does: (1) INSERT `achievement_rewards` row with `ON CONFLICT DO NOTHING`, (2) if inserted, call `creditXP()` (which does its own INSERT + XP update), (3) call `addCoins()`. Steps 1-3 are NOT in a single transaction. If `creditXP` or `addCoins` fails after the reward row is inserted, the reward is marked "claimed" but the user gets no XP/coins. Fix: wrap each tier's insert + credit + addCoins in a `BEGIN/COMMIT` transaction. |

### Missing Features (M-list)

| ID | Description | Status | Evidence |
|---|---|---|---|
| **M1** | 3 of 4 group achievements | NOT IMPLEMENTED | `src/lib/db/group-achievement-config.ts:50` — only "Sincronia" (group-synchrony) exists. "Esquadrão Completo", "Maratona Coletiva", "Consistência de Equipe" are not defined. `achievements.ts:401` logs "Lista de conquistas VAZIA" if no thresholds match. |
| **M2** | Shield design purchase/equip UI | NOT IMPLEMENTED (frontend) | Backend complete: `/api/store/shield-designs` (GET, POST, PATCH), `store.ts` has `getStreakShieldDesigns`, `purchaseStreakShieldDesign`, `equipStreakShieldDesign`. `loja/page.tsx:698` fetches the data but **only uses the equipped icon** — there is NO UI section to browse, purchase, or equip shield designs. |
| **M3** | Focus room join-by-code for new users | NOT IMPLEMENTED (see B5) | The API client has `joinFocusRoom(code, energyType)` but the route structure doesn't support string codes as dynamic segments properly. |
| **M4** | Group kick/unmute/unban from UI | **IMPLEMENTED** | `grupos/page.tsx:1352` — `runMemberAction()` handles ban/unban/kick/promote/demote/mute/unmute. `actionsFor()` (line 1386) builds the action list per member. `MemberActionMenu` (line 62) renders the menu. **This has been wired up since STATUS.md was written.** |
| **M5** | Group create-with-usernames SQL bug | **STILL BUGGY** | `src/lib/db/groups.ts:335` — line: `.filter((u) => u && u !== profileId)`. This compares the username string against the profileId (UUID), which will NEVER match. So the creator's username (if passed) is NOT filtered out and the creator would be invited to their own group. Additionally, the function never adds matched users as direct members — it only sends `group_invites`. The doc comment says "added as members" but the code only creates invites. |
| **M6** | Pinned-message expiration | **PARTIALLY** | The schema supports `pinned_until` and the `pinDmMessage`/`pinGroupMessage` functions accept `durationDays` (7/14/30). The `ChatThread.tsx` renders `formatPinExpiry()` (line 47) and shows "expira em X dias". But the **server-side filtering** of expired pins needs verification — `getGroupPinnedMessages` in `groups.ts` should filter by `pinned_until > now()`. Need to verify this query filters expired pins. |
| **M7** | Pinned-message indicator UI | **PARTIALLY** | `ChatThread.tsx` has pin indicator rendering (line 614-623 area). The pinned banner is shown at the top of the chat. But the STATUS.md says this was on the "unused side of the UI" — need to verify read receipts are properly displayed. |
| **M8** | `markAchievementSeen` / `justUnlocked` | **IMPLEMENTED** (was dead code, now wired) | `app-extras.tsx:87` calls `api.markAchievementSeen(dismissed.id)` when the user dismisses an achievement unlock modal. `achievements.ts:351` computes `justUnlocked`. `app-extras.tsx:39` filters achievements where `a.justUnlocked` to trigger the modal. **This has been fixed since STATUS.md was written.** |
| **M9** | Dead component/file | **PARTIALLY** | `SectionPlaceholder` (`src/components/section-placeholder.tsx`) — confirmed unused (no imports outside definition). `src/lib/db/group-retention.ts` — confirmed unused (no imports). `src/lib/goals-service.ts` — confirmed unused (not imported; only a comment in `goals.ts:31` references it). |

### Other open issues

| ID | Description | Status | Evidence |
|---|---|---|---|
| **O1** | `bestStreak = currentStreak` in reports | **OPEN** | `src/app/api/relatorio/route.ts:41` — `bestStreak: currentStreak.currentStreak, // Would need historical tracking`. The `streak_calendar` table exists (`daily_task_history` or `streak_days` — check schema) but best streak is hardcoded to current. |
| **O2** | Notifications are a dead toggle | **OPEN** | `src/app/configuracoes/page.tsx` has notification settings. `src/lib/reminders.ts` has a local notification scheduler. But `src/lib/reminders.ts` uses browser notifications (`Notification` API) — these are not persistent push notifications. The `notifications_enabled` setting in `user_settings` controls local reminder scheduling only. No server-side push notifications (no FCM, no cron-based email reminders via Resend). Users may expect push/email notifications when the setting is toggled. |
| **O3** | Cloudinary and Resend unused in code | **OPEN** | `.env` has `CLOUDINARY_*` and `RESEND_API_KEY` set. `next.config.ts` allows `res.cloudinary.com` in `remotePatterns`. But `grep -rn "cloudinary\|Cloudinary" src/ --include="*.ts" --include="*.tsx"` finds only the image config in `next.config.ts`. No code imports or calls Cloudinary APIs. No code imports or calls Resend. These are configured but unused — either implement or remove. |

---

## 5. New Issues Found (Not in Existing Documentation)

### 5.1 Environment / Configuration Issues

| # | Issue | Severity | File(s) | Details |
|---|---|---|---|---|
| **E1** | **Stray garbage line in `.env`** | Medium | `.env:4` | The `.env` file contains a line `Senhaincorretab2%` (Portuguese for "wrong password") with no key=value format. This is either a debugging artifact or accidental corruption. It is harmless (Next.js ignores non-assignment lines) but indicates sloppy env management. |
| **E2** | **No `.env.example` file** | Medium | Root | The `SECURITY_AUDIT.md`, `MARKETING_LAUNCH_PLAN.md`, `HUMAN_RESPONSIBILITIES.md`, and `DEBUGGING_GUIDE.md` all reference `.env.example`. It does NOT exist in the repository. The `README.md` says `copy .env.example .env.local`. Without it, new contributors cannot set up the project. The `.gitignore` line `.env*` ignores ALL `.env*` files, which means `.env.example` would also be ignored if it existed (another reason to use `.env.example` and add `.env.local` to gitignore instead — see §5.2). |
| **E3** | **`AUTH_ENFORCE_VERIFIED` env var not set** | High | `server-auth.ts:66` | The code checks `process.env.AUTH_ENFORCE_VERIFIED === "true"` to enforce email verification. But `.env` does NOT contain this variable. The `.env` has `AUTH_ALLOW_UNVERIFIED` instead (which controls the dev bypass). **Result: email verification is NOT actually enforced in production.** The `SECURITY_AUDIT.md` claims H5 was fixed, but the fix is a no-op without the env var being set. Fix: either set `AUTH_ENFORCE_VERIFIED=true` in production, or change the code to check `AUTH_ALLOW_UNVERIFIED !== "true"` (which is already set). |
| **E4** | **Firebase auth domain mismatch** | Medium | `src/lib/firebase.ts:6` | The fallback domain is `"energyos-tan.vercel.app"` — this is a **Vercel** domain, not a Firebase `firebaseapp.com` domain. Firebase Auth requires a `firebaseapp.com` domain (or a custom domain authorized in the Firebase console). The `setup-vercel-env.sh` (line 61) sets `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=energyos-bb7fd.firebaseapp.com`. The `.env` has `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=energyos-tan.vercel.app`. This mismatch means the fallback domain would fail in any environment where the env var is not set. The `.env` value itself may also be wrong (using a Vercel custom domain that may not be authorized in Firebase). **Verify** the correct `authDomain` in the Firebase Console. |
| **E5** | **Hardcoded Firebase domain in CSP** | Low | `next.config.ts:12` | The `frame-src` CSP directive has a fallback to `"energyos-bb7fd.firebaseapp.com"`: `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.replace(/^https?:\/\//, '') ?? "energyos-bb7fd.firebaseapp.com"}`. If the auth domain changes, this fallback would be wrong, and the CSP would block the Google OAuth redirect frame. Should be empty or a known-safe fallback. |
| **E6** | **Supabase configured in `.env` but unused** | Low | `.env:21-23`, `package.json` | The `.env` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and a commented-out `SUPABASE_DATABASE_URL`. `package.json` has `@supabase/ssr` and `@supabase/supabase-js` as dependencies. But `grep -rn "supabase" src/` finds zero imports or usage. The `HUMAN_RESPONSIBILITIES.md` calls Supabase a "backup — not yet configured" but it IS configured in `.env`. Either implement Supabase as a backup DB, or remove the env vars and uninstall the deps. |
| **E7** | **Theme initialization script always defaults to dark** | Low | `src/app/layout.tsx:39` | The `themeScript` inline script: `window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'dark'` — the fallback (last `'dark'`) should be `'light'`. This means even if the user has `prefers-color-scheme: light` and has not set a theme preference, the app always loads in dark mode. Fix: change the final `'dark'` to `'light'`. |
| **E8** | **Empty Dockerfile** | Low | `Dockerfile` (root) | The `Dockerfile` is 0 bytes. The `PROJECT_STATUS.md` mentioned `apps/server/` as an empty shell — that directory does NOT exist. The `docker-compose.yml` provides a local Postgres for dev. The empty Dockerfile should be either populated or removed. |
| **E9** | **`.gitignore` ignores `.env.example`** | Low | `.gitignore:34` | The line `.env*` ignores ALL files matching `.env*`, including `.env.example`. This is a common mistake. If someone runs `git add -f .env.example`, it works, but under normal `git add .` it would be skipped. Should change to `.env.local` and `.env` (and keep `.env.example` tracked). |

### 5.2 Dead Code

| # | File | Why it's dead | Action |
|---|---|---|---|
| **D1** | `src/lib/goals-service.ts` (full file) | Not imported anywhere. `goals.ts:31` comment says "re-exportados daqui para os importers históricos (api-client, goals-service)" but goals-service is not imported by anything. The functionality was superseded by the modular `db/goals.ts`, `db/habits.ts`, `db/settings.ts`. | **Delete** |
| **D2** | `src/components/section-placeholder.tsx` | Exported but never imported. | **Delete** |
| **D3** | `src/lib/db/group-retention.ts` (21 lines) | Not imported anywhere. (File exists alongside `group-room-presence.ts`, `group-synchrony.ts`, `group-achievements.ts`, etc.) | **Delete** |
| **D4** | `/api/league` route + `src/lib/db/league.ts` (old league) | The `liga/page.tsx` uses `api.getLeagueNew()` exclusively. The old `getLeague` api-client method (`api-client.ts:471`) and `/api/league/route.ts` endpoint are not called by any UI. However, `league.ts` exports `xpFromMinutes()` which IS used by `groups.ts:8`. So the module is dead except for that one export. | **Extract `xpFromMinutes` into a shared util, then delete `/api/league/route.ts` and `api.getLeague`** |
| **D5** | `src/lib/league-meta.ts` vs `src/lib/league-new-meta.ts` | `league.ts` imports from `league-meta.ts` (old). `league-new.ts` imports from `league-new-meta.ts` (new). If D4 is resolved, `league-meta.ts` can be deleted. | **Delete after D4** |

### 5.3 Code Quality / Consistency Issues

| # | Issue | Severity | File(s) | Details |
|---|---|---|---|---|
| **Q1** | **Console.log statements in production code** | Medium | `src/app/api/tasks/route.ts:25-26,38` | Three `console.log` statements logging the profile ID and full request body on every task creation. The `SECURITY_AUDIT.md` (M5) said these would be removed from routes, but they remain in `tasks/route.ts`. |
| **Q2** | **Console.log in db modules** | Low | `src/lib/db/tasks.ts:334,360`, `src/lib/db/focus.ts:332` | `tasks.ts:334` logs a full streak reconciliation summary (profileId, counts, status) on every streak computation. `tasks.ts:360` logs shield design fetch failures. `focus.ts:332` logs a `console.warn` for clamped durations. These are not PII but add noise in production. |
| **Q3** | **`any` types in relatorio page** | Medium | `src/app/relatorio/page.tsx:97-122` | `processReportData(apiData: any, goals: any[], days: number)` — both parameters are `any`, and the `.map((c: any) => ...)` callbacks use `any` for iteration. This bypasses TypeScript's type checking. Should use the actual types: `DashboardSnapshotResponse` and `GoalWithProgress[]`. |
| **Q4** | **16 `eslint-disable-next-line` suppressions** | Low | Multiple files | 10 suppress `react-hooks/exhaustive-deps` (dashboard:195, loja:720, salas-de-foco:332+685, ui:127+196, focus-timer:507) and 5 suppress `@next/next/no-img-element` (loja:245,513,1044; perfil:892; avatar:111,132; achievement-ui:129, xp-badge:174, profile-banner:13). The hook-deps suppressions hide potential stale-closure bugs. The img-element suppressions are acceptable but should be migrated to `next/image` for optimization. |
| **Q5** | **Inconsistent API error handling patterns** | Low | 48 API route files | 68 routes use `handleRoute()` (the standard wrapper with consistent error mapping). 48 routes (leagues, social, store, chat, friends, etc.) use their own `try { requireAuth } catch (error instanceof AppError)` boilerplate. This is inconsistent — some routes map `ValidationError` to 400, some don't, some log errors, some don't. **Recommendation:** migrate all 48 to `handleRoute` for consistency. |
| **Q6** | **Raw `<img>` tags instead of `next/image`** | Low | 15 instances | `dashboard/page.tsx:1074`, `grupos/page.tsx:116,874,908,1488,1674`, `loja/page.tsx:1045`, `perfil/page.tsx:893`, `avatar.tsx:133`, `ChatThread.tsx:161,579`, `monthly-recap-premium.tsx:253,501`, `achievement-ui.tsx`, `xp-badge.tsx:174`, `profile-banner.tsx`. These bypass Next.js image optimization (no sizing, no lazy loading, no modern format conversion). |
| **Q7** | **Hardcoded admin email in perfil page** | Medium | `src/app/perfil/page.tsx:251` | `user.email === "pciskolargx@gmail.com"` gates the env-status UI. This is a hardcoded email check instead of a role-based check. The `SECURITY_AUDIT.md` (H2) already fixed the `/api/env-status` endpoint to use `requireAdmin()`, but the **frontend** still uses email comparison. If the admin email changes or another admin is added, this breaks. Fix: use the `role` field from the user profile instead. |

### 5.4 TypeScript / Build Issues

| # | Issue | Severity | File(s) | Details |
|---|---|---|---|---|
| **T1** | **`XIcon` imported but unused** | Low | `src/app/amigos/page.tsx:16` | Line 16: `X, XIcon,` — `XIcon` is imported but never used. `X` is used in the friend request buttons (line 408). `XIcon` is dead. (Does not cause a build error because TS doesn't error on unused imports by default, but ESLint would catch it.) |

### 5.5 Documentation Drift

| # | Issue | Details |
|---|---|---|
| **DOC1** | `PROJECT_STATUS.md` is outdated | Last updated 2026-08-24. It claims: no middleware.ts (exists), no mobile nav (exists), no `.env.example` (doesn't exist), `apps/server/` empty shell (directory doesn't exist), `DM Mono` font never loads (it's now imported in `layout.tsx:11`), and only 15 API endpoints (there are 116). **The document should be updated or archived.** |
| **DOC2** | `COLLABORATION_PROMPT.md` is outdated | References `src/proxy.ts` (doesn't exist), `src/components/ui.tsx` primitives as "mostly unused" (status unclear), and only 15 API routes. Written for early-stage opencode collaboration. |
| **DOC3** | `README.md` is a sketch | Described as "Rascunho inicial" (initial draft). Only covers the early local-storage prototype phase. Should be updated to reflect the current Firebase + Neon + gamification architecture. |
| **DOC4** | `DEBUGGING_GUIDE.md` env section is stale | References `energyos-bb7fd.firebaseapp.com` (line 169-174) but `.env` has `energyos-tan.vercel.app`. |

---

## 6. Feature Completeness Assessment

### Pages / Routes

| Route | Page Component | API Routes | Status |
|---|---|---|---|
| `/` (landing) | `src/app/page.tsx` → `landing-page.tsx` | — | ✅ Complete: 3D scene, hero, features, phone mockup, CTA, auto-redirect for logged-in users |
| `/login` | `src/app/(auth)/login/page.tsx` | — | ✅ Complete: email/password, Google OAuth, password reset |
| `/cadastro` | `src/app/(auth)/cadastro/page.tsx` | — | ✅ Complete: registration with name, email, password, Google OAuth |
| `/auth/callback` | `src/app/auth/callback/page.tsx` | — | ✅ Complete: OAuth redirect handler |
| `/auth/action` | `src/app/(auth)/auth/action/page.tsx` | — | ✅ Complete: password reset, email verification callbacks |
| `/dashboard` | `src/app/dashboard/page.tsx` (1200+ lines) | `/api/dashboard` | ⚠️ B1: check-in state doesn't persist on reload. Study/training/energy inputs missing from check-in UI despite API support. |
| `/dashboard/consistencia` | `src/app/dashboard/consistencia/page.tsx` | `/api/streak-calendar` | ✅ Complete: consistency heatmap |
| `/amigos` | `src/app/amigos/page.tsx` (561 lines) | `/api/friends/*`, `/api/dm/*`, `/api/social/*` | ⚠️ B2: ownership comparison (appears fixed but needs runtime verification) |
| `/grupos` | `src/app/grupos/page.tsx` (1900+ lines) | `/api/groups/*` (20+ routes) | ⚠️ B3: mobile whitespace. M5: create-with-usernames SQL bug. M6: pin expiry needs verification. |
| `/salas-de-foco` | `src/app/salas-de-foco/page.tsx` (1800+ lines) | `/api/focus-rooms/*` (25 routes) | ⚠️ B4: pause/resume race (partially fixed). B5: join-by-code for new users broken. B6: leave-while-waiting workaround. |
| `/liga` | `src/app/liga/page.tsx` | `/api/league-new` | ✅ Complete: new league system (Bronze/Prata/Ouro/Diamante/Lendas) |
| `/loja` | `src/app/loja/page.tsx` | `/api/store/*` (10 routes) | ⚠️ M2: shield design purchase/equip UI missing |
| `/jardim` | `src/app/jardim/page.tsx` | `/api/garden` | ✅ Complete: garden visualization |
| `/perfil` | `src/app/perfil/page.tsx` | `/api/profile` | ⚠️ E7: hardcoded admin email check |
| `/relatorio` | `src/app/relatorio/page.tsx` | `/api/relatorio` | ⚠️ O1: `bestStreak = currentStreak`. Q3: `any` types. |
| `/configuracoes` | `src/app/configuracoes/page.tsx` | `/api/settings` | ⚠️ O2: notifications toggle doesn't send push/email |

### API Route Inventory (116 route files)

**High-quality, consistent patterns:**
- `/api/checkins` — ✅ Security-hardened (today-only date, atomic first-save detection)
- `/api/tasks/*` — 5 routes, ✅ handleRoute, parameterized SQL. ⚠️ Console.log on POST (Q1).
- `/api/focus` — ✅ Duration clamped to target, idempotent creditXP
- `/api/dashboard` — ✅ Server-side snapshot computation
- `/api/daily-quests/*` — ✅ Cheat path removed, sessionData clamped
- `/api/store/*` (10 routes) — ✅ All purchases rewritten as atomic transactions
- `/api/kanban/*` — ✅ Move/promote with XP award

**Inconsistent patterns (use try/catch instead of handleRoute):**
- `/api/league*` — 2 routes, own error handling
- `/api/social/*` — 4 routes
- `/api/groups/*` — 20+ routes
- `/api/dm/*` — 5 routes
- `/api/friends/*` — 4 routes
- `/api/focus-rooms/*` — 25 routes
- `/api/recap/*` — 2 routes
- `/api/achievements` — 1 route
- `/api/env-status` — ✅ Uses handleRoute + requireAdmin
- `/api/test` — ✅ Returns 404 in production

### Key Library Modules (37 files in `src/lib/db/`)

| Module | Lines | Quality | Notes |
|---|---|---|---|
| `db.ts` | 169 | ✅ Good | Connection pool, TLS config, goal/habit mappers |
| `validation.ts` | 107 | ✅ Good | Comprehensive parsers (dates, numbers, enums, profile IDs, messages, titles) |
| `http.ts` | 91 | ✅ Good | handleRoute, readJsonBody, jsonOk/jsonError |
| `server-auth.ts` | 134 | ⚠️ See E3 | Token verification via Identity Toolkit, cache, dev bypass. `AUTH_ENFORCE_VERIFIED` not set in `.env`. |
| `xp.ts` | 136 | ✅ Good | Idempotent `creditXP` with ledger unique index |
| `checkins.ts` | 169 | ✅ Good | Today-only check-ins, atomic first-save detection (`xmax = 0` trick) |
| `tasks.ts` | 465 | ⚠️ See Q2 | Streak computation with shield protection. Console.log in streak reconciliation. |
| `focus.ts` | 603 | ✅ Good | Focus session with clamped duration. |
| `focus-rooms.ts` | 1586 | ⚠️ See B4/B5 | Pause/resume use row locks. Join-by-code routing issue. Large file (consider splitting). |
| `groups.ts` | 1424 | ⚠️ See M5 | Group CRUD + chat. `createGroupWithUsernames` has SQL bug. Large file (consider splitting). |
| `messages.ts` | 555 | ✅ Good | DM send/read/pin/react with friendship checks. `markDmRead` now enforces friendship. |
| `achievements.ts` | 502 | ⚠️ See B7 | `awardAchievementRewards` not transactional. Uses safeQuery for resilience. |
| `store.ts` | 656 | ✅ Good | All 5 purchase functions are atomic transactions. |
| `xp-boost.ts` | 206 | ✅ Good | 2x potion, cap-race fixed. |
| `daily-quests.ts` | 701 | ✅ Good | Metric-driven progress tracking. |
| `daily-tasks.ts` | 991 | ✅ Good | User-written daily habits with frequencies, reminders. |
| `kanban.ts` | 451 | ✅ Good | Board with labels, drag-and-drop, XP award. |
| `weekly-plans.ts` + `weekly-plans-series.ts` (662 lines) | ✅ Good | Recurring events, occurrences, skip/override. |
| `dashboard.ts` | 94 | ✅ Good | Snapshot computation. |
| `goals.ts` | 345 | ✅ Good | Goal CRUD with progress. |
| `habits.ts` | 144 | ✅ Good | Habit CRUD. |
| `profiles.ts` | 237 | ✅ Good | Profile management with role fetching. |
| `settings.ts` | 149 | ✅ Good | Settings CRUD, coins management. |
| `social.ts` | 455 | ✅ Good | Friends, search (no email matching), public profiles. |
| `insights.ts` | 153 | ✅ Good | Weekly insight generation. |
| `recap.ts` | 422 | ✅ Good | Monthly recap with premium share. |
| `categories.ts` | 218 | ✅ Good | Category CRUD. |
| `league-new.ts` (576 lines) + `league.ts` (223 lines) | ⚠️ See D4 | **Dual league system** — old (`league.ts`) uses faisca/chama/aura/nucleo tiers; new (`league-new.ts`) uses Bronze/Prata/Ouro/Diamante/Lendas. The UI only uses the new system. The old API route (`/api/league`) is dead. |
| `group-leaderboard.ts` (422) | ✅ Good | Leaderboard with period scoping. |
| `group-milestones.ts` (285) | ✅ Good | Weekly quest + milestones. |
| `group-achievements.ts` (250) | ⚠️ See M1 | Only "Sincronia" implemented. |
| `group-synchrony.ts` (28) | ✅ Good | Group synchrony achievement. |
| `group-achievement-config.ts` (45) | ⚠️ See M1 | Only 1 achievement config. |
| `group-room-presence.ts` (120) | ✅ Good | Presence tracking for focus rooms. |
| `achievement-progress.ts` (50) | ✅ Good | Focus companion progress tracking. |
| `bootstrap.ts` (202) | ✅ Good | Ensures all user rows exist on first auth. |
| `xp-ledger.ts` (77) | ✅ Good | XP ledger queries. |
| `optional-fields.ts` (21) | ✅ Good | Optional field helpers. |
| `dates.ts` | ✅ Good | Timezone-aware date utilities (America/Sao_Paulo). |
| `goal-logs.ts` | ✅ Good | Goal progress logging. |
| `recap.ts` | ✅ Good | Monthly recap. |

### Auth & Middleware

| Component | File | Status |
|---|---|---|
| `AuthProvider` | `src/lib/auth-context.tsx` | ✅ Good — Firebase state listener, session cookie management, `useAuthRedirect` hook |
| `requireAuth` | `src/lib/server-auth.ts` | ✅ Good — Identity Toolkit token verification, 5-min cache, dev bypass |
| `requireAdmin` | `src/lib/server-auth.ts:127` | ✅ Good — DB-backed role check |
| `middleware.ts` | `src/middleware.ts` | ✅ Good — cookie-based route protection (protected + guest-only) |
| `route-access.ts` | `src/lib/route-access.ts` | ✅ Good — protected/guest route definitions, cookie name |
| `api-client.ts` | `src/lib/api-client.ts` (502 lines) | ✅ Good — typed fetch wrapper with Bearer token, retry logic (408/429/5xx), typed API methods |

---

## 7. Prioritized Action Plan

### Phase 0 — Critical Fixes (Do First)

1. **E3: Fix email verification enforcement** — Set `AUTH_ENFORCE_VERIFIED=true` in production `.env`/Vercel, OR align the code to check `AUTH_ALLOW_UNVERIFIED !== "true"` (which is already configured). This is the only security fix that is "done in code" but not actually active.
2. **M14 (from SECURITY_AUDIT): Deduplicate `xp_ledger` + run `npm run db:init`** — The production DB still has the old schema (bigint `source_id`, no `kanban_task` in CHECK, no dedupe index) and 6 duplicate reward groups. Running `npm run db:init` will FAIL until the dedupe SQL is run manually. **This is a manual ops step.**
3. **E7: Fix admin email hardcoding** — Replace `user.email === "pciskolargx@gmail.com"` in `perfil/page.tsx:251` with a role-based check (`user.role === "admin"` or fetch profile and check role).
4. **B5: Fix focus room join-by-code** — Investigate the route structure: `api.joinFocusRoom/code` POSTs to `/api/focus-rooms/${code}/join` but the route file is `[roomId]/join/route.ts` (expects numeric roomId). Need to either add a `[code]/join/route.ts` route or change the client to resolve the code to a roomId first via `getFocusRoomByCode`.
5. **M5: Fix createGroupWithUsernames SQL bug** — Line 335: `.filter((u) => u && u !== profileId)` compares username to UUID. Fix: don't filter by profileId at all (usernames and UUIDs are different namespaces). Also, decide: should matched users be added as members directly or only invited?

### Phase 1 — Bugs (Code Fixes)

6. **B1: Fix check-in state persistence on reload** — In `dashboard/page.tsx`, derive `checkinSaved` and `sleepAnswer` from `snapshot.checkins` (look for today's checkin entry) inside the snapshot useEffect, not just from client-only `useState`.
7. **B7: Wrap achievement reward mint in transaction** — In `achievements.ts:82-119`, wrap each tier's INSERT + creditXP + addCoins in a `BEGIN/COMMIT` transaction so a failure rolls back the reward row and nothing is lost or double-awarded.
8. **O1: Fix `bestStreak` in reports** — Either add a `best_streak` column to `profiles` (updated by the streak reconciliation in `tasks.ts`), or track it in `streak_calendar`/`streak_days` table. Query the max streak from the streak log table.
9. **Q1/Q2: Remove or gate console.log statements** — Remove the `console.log` in `tasks/route.ts:25-26,38`, `tasks.ts:334,360`, and gate `focus.ts:332` behind `NODE_ENV !== "production"`.

### Phase 2 — Missing Features (UI)

10. **M2: Shield design purchase/equip UI** — Backend is complete (`/api/store/shield-designs`, `store.ts`). Add a "Escudos" section in the Loja (`loja/page.tsx`) with a grid of shield designs, purchase buttons, equip buttons, and a preview of the equipped design.
11. **Check-in form expansion** — The API (`checkins.ts`) supports `studyMinutes`, `trainingMinutes`, `energyScore` but the dashboard check-in form only captures `sleepHours`. Add inputs for study minutes, training minutes, and energy score (1-5 slider) to the check-in UI.
12. **B6: Clean up focus room leave-while-waiting** — Refactor `handleLeaveRoom` in `salas-de-foco/page.tsx` to handle the "waiting" status more cleanly.

### Phase 3 — Cleanup & Consistency

13. **Delete dead code**: `goals-service.ts`, `section-placeholder.tsx`, `group-retention.ts`
14. **Migrate old league**: Extract `xpFromMinutes` from `league.ts` into a shared util, delete `/api/league/route.ts` and `api.getLeague` from `api-client.ts`, delete `league-meta.ts` and `league.ts`
15. **Q5: Migrate 48 non-handleRoute routes to use `handleRoute`** for consistent error handling
16. **Q6: Replace raw `<img>` with `next/image`** in all 15 instances (or at least the ones loading remote URLs — avatars, banners, store items)
17. **Q3: Replace `any` types in `relatorio/page.tsx`** with proper types
18. **Q4: Reduce `eslint-disable` suppressions** — especially the `react-hooks/exhaustive-deps` ones (review for stale closures)

### Phase 4 — Environment & Docs

19. **E2: Create `.env.example`** with all required/optional vars (placeholders, not real values)
20. **Fix `.gitignore` line 34** — Change `.env*` to be more specific: keep `.env.local` and `.env` ignored, but allow `.env.example` to be tracked
21. **E4: Fix Firebase auth domain** — Verify the correct `authDomain` in the Firebase Console and update `.env` + `firebase.ts` fallback
22. **E5: Fix CSP domain fallback** in `next.config.ts:12`
23. **E1: Remove stray line** from `.env`
24. **E8: Populate or remove Dockerfile**
25. **DOC1-4: Update/archive stale documentation** (`PROJECT_STATUS.md`, `COLLABORATION_PROMPT.md`, `README.md`, `DEBUGGING_GUIDE.md`)

---

## 8. Environment Variables Reference

### Currently in `.env` (redacted values)

| Variable | Set | Used in code | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | `firebase.ts` | Required |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | `firebase.ts` | Value is `energyos-tan.vercel.app` — **may be wrong** (should be a `*.firebaseapp.com` domain). See E4. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | `firebase.ts` | Required |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | `firebase.ts` | Required |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | `firebase.ts` | Required |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | `firebase.ts` | Required |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | ✅ | — | For GA4 (not directly in firebase.ts, may be unused) |
| `DATABASE_URL` | ✅ | `db.ts` | Neon PostgreSQL — required |
| `DATABASE_SSL_STRICT` | ✅ | `db.ts` | Enables strict TLS in production |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ❌ Unused | Supabase backup not implemented |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | ❌ Unused | Supabase backup not implemented |
| `# SUPABASE_DATABASE_URL` | (commented) | ❌ | Not configured |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ✅ | ❌ Unused | Cloudinary not used in code |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | ✅ | ❌ Unused | Cloudinary not used in code |
| `CLOUDINARY_API_KEY` | ✅ | ❌ Unused | Cloudinary not used in code |
| `CLOUDINARY_API_SECRET` | ✅ | ❌ Unused | Cloudinary not used in code |
| `RESEND_API_KEY` | ✅ | ❌ Unused | Resend not used in code — no email sending implemented |
| `RESEND_FROM_EMAIL` | ✅ | ❌ Unused | Resend not used in code |
| `NEXT_PUBLIC_APP_URL` | ✅ | `api-client.ts` (likely) | App base URL |
| `NODE_ENV` | ✅ | Multiple | Should be "development" locally, "production" on Vercel |
| `AUTH_ALLOW_UNVERIFIED` | ✅ | `server-auth.ts:85` | Dev bypass — should be "false"/"unset" in production |
| `AUTH_ENFORCE_VERIFIED` | ❌ **NOT SET** | `server-auth.ts:66` | **Bug (E3): email verification not enforced** |
| `CRON_SECRET` | ✅ | `focus-rooms/cleanup/route.ts` | Required for scheduled cleanup |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ✅ | — | GA4 — not yet wired in `layout.tsx` (no `GoogleAnalytics` component) |

### Missing env vars

| Variable | Needed for | Referenced in docs |
|---|---|---|
| `DATABASE_SSL_CA_PATH` | Optional CA pinning | `SECURITY_AUDIT.md` M7 |
| `.env.example` | New contributor setup | Multiple docs reference it but it doesn't exist |

---

## 9. Dependencies Audit

### Direct dependencies (`package.json`)

| Package | Version | Status |
|---|---|---|
| `next` | 16.3.2 | ✅ Used |
| `react` | ^19.2.8 | ✅ Used |
| `react-dom` | ^19.2.8 | ✅ Used |
| `typescript` | ^5 | ✅ Dev dep |
| `tailwindcss` | ^4 | ✅ Used |
| `framer-motion` | ^12.23.12 | ✅ Used (landing + micro-interactions) |
| `firebase` | ^12.18.0 | ✅ Used (auth) |
| `pg` | ^8.23.0 | ✅ Used (PostgreSQL) |
| `recharts` | ^3.10.1 | ✅ Used (relatorio charts) |
| `lucide-react` | ^0.468.0 | ✅ Used (icons) |
| `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` | latest | ✅ Used (landing 3D scene) |
| `lenis` | ^1.3.26 | ✅ Used (smooth scroll on landing) |
| `date-fns` | ^4.4.0 | ✅ Used (date utilities) |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | latest | ✅ Used (kanban drag-and-drop) |
| `@anthropic-ai/*`, `@langchain/*`, `@langchain/anthropic` | latest | ❓ **Unused?** — AI/LLM packages. Check if any code imports these. |
| `@supabase/ssr`, `@supabase/supabase-js` | latest | ❌ **NOT imported anywhere** (E6) |
| `cline` | ^3.0.60 | ❓ **Unused?** — CLI tool package |
| `cursor-cli` | ^1.0.0 | ❓ **Unused?** — CLI tool package |
| `vercel` | ^59.11.7 | ❓ **Unused?** — Vercel CLI |

### Recommendations
- **Remove unused deps**: `@supabase/ssr`, `@supabase/supabase-js` (unless implementing Supabase backup)
- **Audit AI/cli deps**: `@anthropic-ai/*`, `@langchain/*`, `cline`, `cursor-cli`, `vercel` — verify they're actually needed. These may be dev/CI tools, but they're in `dependencies` (not `devDependencies`), which means they ship to production.

---

## 10. Testing Gaps

| Area | Test file | Coverage |
|---|---|---|
| Date utilities | `dates.test.ts` | ✅ 8 tests |
| Focus rewards | `focus-rewards.test.ts` | ✅ 3 tests |
| Activity tracking | `activity.test.ts` | ✅ Tests exist |
| Consistency calendar | `consistency-calendar.test.ts` | ✅ Tests exist |
| Habit scheduling | `habit-schedule.test.ts` | ✅ Tests exist |
| Habit icons | `habit-icons.test.ts` | ✅ Tests exist |
| Daily habit progress | `daily-habit-progress.test.ts` | ✅ Tests exist |
| Garden aggregation | `garden-aggregation.test.ts` | ✅ Tests exist |
| Weekly plan recurrence | `weekly-plan-recurrence.test.ts` | ✅ Tests exist |

**Gaps:**
- ❌ No API route tests (critical endpoints: auth, checkins, store, XP)
- ❌ No integration tests (database → API → client)
- ❌ No end-to-end tests (Cypress, Playwright)
- ❌ No component tests (testing-library)
- ❌ No load/performance tests

---

## 11. Quick Reference for Claude

```bash
# Typecheck (passes)
npx tsc --noEmit

# Lint (passes, no warnings)
npx eslint src/

# Tests (36/36 pass)
npm test

# Apply schema migration (after manual xp_ledger dedupe — see M14)
npm run db:init

# Seed admin (promotes pciskolargx@gmail.com to admin)
npm run db:seed-admin

# Local dev
npm run dev

# Production build
npm run build
npm start
```

### Key file paths Claude should know

| Concern | File(s) |
|---|---|
| Route protection | `src/middleware.ts`, `src/lib/route-access.ts` |
| Auth (client) | `src/lib/auth-context.tsx`, `src/lib/firebase.ts` |
| Auth (server) | `src/lib/server-auth.ts` |
| API error handling | `src/lib/http.ts`, `src/lib/errors.ts` |
| Input validation | `src/lib/db/validation.ts` |
| Database connection | `src/lib/db.ts` |
| XP system | `src/lib/db/xp.ts`, `src/lib/db/xp-ledger.ts`, `src/lib/xp-levels.ts` |
| Check-in (security-critical) | `src/lib/db/checkins.ts`, `src/app/api/checkins/route.ts` |
| Store purchases (security-critical) | `src/lib/db/store.ts`, `src/app/api/store/*/` |
| Achievements | `src/lib/db/achievements.ts`, `src/lib/db/achievement-progress.ts` |
| Focus rooms (bugs B4/B5/B6) | `src/lib/db/focus-rooms.ts`, `src/app/salas-de-foco/page.tsx`, `src/app/api/focus-rooms/` |
| Groups (bug M5, B3) | `src/lib/db/groups.ts`, `src/app/grupos/page.tsx`, `src/app/api/groups/` |
| Chat components | `src/components/chat/ChatThread.tsx`, `src/components/chat/ChatComposer.tsx` |
| Dashboard (bug B1) | `src/app/dashboard/page.tsx` |
| Relatorio (bug O1, Q3) | `src/app/api/relatorio/route.ts`, `src/app/relatorio/page.tsx` |
| Perfil (bug E7) | `src/app/perfil/page.tsx:251` |
| Loja (missing M2) | `src/app/loja/page.tsx`, `src/lib/db/store.ts`, `src/app/api/store/shield-designs/route.ts` |
| Env status | `src/app/api/env-status/route.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| PWA | `src/lib/sw-register.ts`, `src/app/manifest.ts` |
| Reminders | `src/lib/reminders.ts` |
| Theme | `src/lib/theme-provider.tsx`, `src/app/globals.css` |

---

## 12. Summary: What Needs To Happen To "Finish" the Website

### Must-fix before any kind of launch (P0)

| # | Issue | Files |
|---|---|---|
| P0-1 | Deduplicate `xp_ledger` + run `db:init` migration (M14) | Manual SQL → `npm run db:init` |
| P0-2 | Set `AUTH_ENFORCE_VERIFIED=true` in prod (or align code) | `server-auth.ts`, `.env`/Vercel |
| P0-3 | Remove stray line from `.env` | `.env:4` |
| P0-4 | Verify/fix Firebase auth domain (E4) | `firebase.ts:6`, `.env`, `next.config.ts:12` |
| P0-5 | Create `.env.example` | New file |
| P0-6 | Fix hardcoded admin email in perfil (E7) | `perfil/page.tsx:251` |
| P0-7 | Fix check-in state on reload (B1) | `dashboard/page.tsx:112-114,206-207` |
| P0-8 | Fix focus room join-by-code (B5) | `focus-rooms.ts`, `salas-de-foco/page.tsx`, `api/focus-rooms/` route structure |
| P0-9 | Fix `bestStreak` in relatorio (O1) | `api/relatorio/route.ts:41` |
| P0-10 | Remove console.log from routes (Q1/Q2) | `api/tasks/route.ts`, `db/tasks.ts`, `db/focus.ts` |

### Should-fix before launch (P1)

| # | Issue | Files |
|---|---|---|
| P1-1 | Shield design purchase/equip UI (M2) | `loja/page.tsx` |
| P1-2 | Check-in form: add study/training/energy inputs | `dashboard/page.tsx` |
| P1-3 | Achievement reward transaction (B7) | `db/achievements.ts:82-119` |
| P1-4 | Fix createGroupWithUsernames SQL bug (M5) | `db/groups.ts:335` |
| P1-5 | Clean up focus room leave-while-waiting (B6) | `salas-de-foco/page.tsx:767-784` |
| P1-6 | Replace `any` types in relatorio (Q3) | `relatorio/page.tsx:97-122` |
| P1-7 | Delete dead code (D1-D3) | `goals-service.ts`, `section-placeholder.tsx`, `group-retention.ts` |
| P1-8 | Replace raw `<img>` with `next/image` (Q6) | 15 instances across 8 files |
| P1-9 | Unify API error handling (Q5) | 48 non-handleRoute routes |

### Nice-to-have before launch (P2)

| # | Issue | Files |
|---|---|---|
| P2-1 | Pin expiry enforcement server-side (M6) | `db/groups.ts` (pin query) |
| P2-2 | Migrate old league system (D4/D5) | `db/league.ts`, `api/league/route.ts`, `api-client.ts:471` |
| P2-3 | Theme script fallback fix (E7) | `layout.tsx:39` |
| P2-4 | Fill or remove Dockerfile (E8) | `Dockerfile` |
| P2-5 | Fix .gitignore for .env files (E9) | `.gitignore:34` |
| P2-6 | Implement or remove Cloudinary/Resend/Supabase deps | `package.json`, `.env` |
| P2-7 | Wire up Google Analytics component | `layout.tsx` (see MARKETING_LAUNCH_PLAN Phase 5) |
| P2-8 | Privacy Policy + Terms pages | New pages: `/privacidade`, `/termos` |
| P2-9 | Cookie consent banner | New component (Phase 4 of marketing plan) |
| P2-10 | SEO: per-page metadata, sitemap, robots.txt | `app/*/page.tsx` metadata exports |
| P2-11 | Error boundaries | New component (wrap page sections) |
| P2-12 | Loading skeletons | `dashboard/page.tsx`, `relatorio/page.tsx` |
| P2-13 | More test coverage | API route tests, integration tests |
| P2-14 | Update stale documentation | `PROJECT_STATUS.md`, `COLLABORATION_PROMPT.md`, `README.md`, `DEBUGGING_GUIDE.md` |

---

## 13. Files That Claude Should NOT Touch Without Checking

| File | Reason |
|---|---|
| `src/db-schema.sql` | Manual ops step required: deduplicate `xp_ledger` BEFORE running `db:init` (M14). Running it on production without dedupe will fail atomically. |
| `src/lib/server-auth.ts:66` | `AUTH_ENFORCE_VERIFIED` gate — changing this affects all authenticated requests. Coordinate with env var changes. |
| `src/lib/db/xp.ts` | `creditXP` is the ONLY XP write path. Any change here affects the entire economy. |
| `src/lib/db/store.ts` | All 5 purchase functions were rewritten as atomic transactions after the C4 security audit. Do NOT revert to the old pattern. |
| `src/lib/db/checkins.ts` | Security-critical: today-only check-ins, atomic first-save detection. Do NOT reintroduce client-supplied dates. |
| `src/middleware.ts` | Route protection depends on the session cookie name (`energyos_session`). Changing it requires updating `auth-context.tsx` too. |
| `src/app/api/focus-rooms/cleanup/route.ts` | Now requires admin or `CRON_SECRET`. Do NOT weaken the gate. |
| `src/next.config.ts` | CSP and image allowlist are security-critical. Any new image host must be added to `remotePatterns` AND the CSP `img-src`/`connect-src`. |

---

*End of analysis. This document was generated from a full code review of the EnergyOS codebase (303 source files, 116 API routes, 37 db modules) against the existing documentation (`STATUS.md`, `SECURITY_AUDIT.md`, `PROJECT_STATUS.md`, `MARKETING_LAUNCH_PLAN.md`, `DEBUGGING_GUIDE.md`, `HUMAN_RESPONSIBILITIES.md`, `COLLABORATION_PROMPT.md`).*
