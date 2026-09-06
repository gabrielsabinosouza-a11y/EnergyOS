# EnergyOS — Status

Current state of the web app (as code-reviewed; see "Verification" for how this was produced).

**Legend**: WORKING = implemented and used by the UI · PARTIAL = works but with gaps/races · MISSING = backend and/or UI not wired · FIXED = previously reported, now resolved in code · UNVERIFIED = not runtime-tested, code review only.

## Overview

EnergyOS is a gamified productivity web app (Next.js App Router + Firebase Auth + Postgres). The dashboard is the hub (check-in, streak, daily quests, tasks, weekly plan, kanban, goals/habits, focus timer) around a social/economy layer (XP/coins, Loja, auras, achievements, Liga, grupos, amigos DM, jardim).

Overall: the core loop (check-in → streak → XP/coins → quests → achievements → store) is implemented end-to-end and mostly WORKING. The social layer is the roughest: Grupos has several un-wired UI actions and only one of four planned group achievements; Focus rooms have a broken join-by-code and a pause/resume race; Amigos DM likely mis-detects the current user's own messages.

## Feature area matrix

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Check-in (dashboard) | WORKING (UI gap) | `src/lib/db/checkins.ts`, `src/app/dashboard/page.tsx:196-228` | Persists server-side; XP/coins idempotent via ledger. Button/sleep state resets on reload (bug B1). |
| Streak | WORKING | `src/lib/db/tasks.ts:218-402` (`computeStreak`), `streak-calendar` API | Server-computed; shield count, todayQualified, statuses exposed in snapshot. |
| Daily quests / missions | WORKING | `src/lib/db/daily-quests.ts`, `recordMissionProgress` hook | Metrics-driven; claims idempotent (`daily_mission_claims` unique). |
| Recurring daily tasks | WORKING | `src/lib/db/daily-tasks.ts`, `/api/daily-tasks` | |
| Weekly plan (Plano da Semana) | WORKING | `src/lib/db/weekly-plans.ts`, `src/components/dashboard/weekly-plan.tsx` | Create/edit/complete/delete all wired, optimistic + rollback. |
| Kanban | WORKING | `src/lib/db/kanban.ts`, `src/components/dashboard/kanban-board.tsx` | Board, labels, detail modal, XP award. |
| Goals + habits | WORKING | `src/lib/db/goals.ts`, `src/lib/db/habits.ts`, `goals-card.tsx` | Progress adjust, delete, update, goal-habit links. |
| Focus timer (individual) | WORKING | `src/lib/db/focus.ts`, `src/components/dashboard/focus-timer.tsx` | Track/end, streak roll, paused_count tracking for Flow State. |
| Flow State achievement | WORKING | `src/lib/db/achievements.ts:23,200-207,230`, `src/db-schema.sql:673` | 90/120 min uninterrupted (`paused_count = 0`); needs `db:init` on existing DBs. |
| Focus rooms (salas) | PARTIAL | `src/lib/db/focus-rooms.ts`, `src/app/salas-de-foco/page.tsx` | See B4/B5/B6. |
| XP / levels / Liga | WORKING | `src/lib/db/xp.ts`, `src/lib/db/league.ts`, `src/lib/db/league-new.ts`, `src/app/liga/page.tsx` | Single XP write path `creditXP` applies boost to all sources. |
| 2x XP potion | WORKING | `src/lib/db/xp-boost.ts`, `src/lib/xp-boost.ts` | Coins never doubled — bug history item fixed. |
| Coins / Loja | WORKING | `src/lib/db/store.ts`, `src/app/loja/page.tsx` | All 5 sections real. Shield-design purchase/equip UI MISSING (M2). |
| Auras | WORKING | auras served/equipped from DB in `dashboard/page.tsx` + `salas-de-foco/page.tsx` | Reload-revert to Flame bug FIXED (server-first restore). |
| Achievements | WORKING | `src/lib/db/achievements.ts`, `src/lib/achievement-ui.tsx` | 12/12 incl. dynamic `aura_collector`; PT names; tier progress %; dot/ring UI. |
| Meu jardim | WORKING | `src/lib/db/store.ts` (garden), `src/app/jardim/page.tsx` | |
| Grupos | PARTIAL | `src/lib/db/groups.ts`, `src/app/grupos/page.tsx` | Chat strong; see M1-M5 + B3. |
| Amigos / DM | PARTIAL (suspected bug) | `src/app/amigos/page.tsx`, `src/lib/db/messages.ts`, `ChatThread.tsx` | See B2. |
| Configurações | WORKING | `src/app/configuracoes/page.tsx`, `src/lib/db/settings.ts` | Profile, theme, security/session (full settings app). |
| Relatório (insights) | WORKING | `src/lib/db/insights.ts`, `src/app/relatorio/page.tsx` | |
| Perfil | WORKING | `src/app/perfil/page.tsx`, `src/lib/db/profiles.ts` | |
| Monthly recap | WORKING | `src/lib/db/recap.ts`, `monthly-recap-premium.tsx` | Premium share flow |

## Missing / not implemented

| # | Item | Detail | Evidence |
|---|---|---|---|
| M1 | Group achievements (3 of 4) | Only "Sincronia" exists (`group-synchrony.ts`). Esquadrão Completo, Maratona Coletiva, Consistência de Equipe are not implemented | `src/lib/db/groups.ts`, achievements list |
| M2 | Shield design purchase/equip UI | Backend complete (`/api/store/shield-designs`, `store.ts`) but no user-facing UI to buy/equip | `src/app/loja/page.tsx` |
| M3 | Focus room join-by-code for new (non-member) users | Room codes create/list fine, but joining by code as a first-time member is broken | `focus-rooms.ts` (join path), `salas-de-foco/page.tsx` |
| M4 | Group kick / unmute / unbans from UI | Server actions exist; not reachable from member UI | `grupos/page.tsx` |
| M5 | Group create-with-usernames | Never wired to UI; underlying SQL has a bug | `grupos/page.tsx`, `groups.ts` |
| M6 | Pinned-message expiration in group chat | Pin has no expiry | `ChatThread.tsx`, `groups.ts` |
| M7 | Pinned-message indicator UI | Pin state is tracked but read receipts are unused side of the UI | `ChatThread.tsx` |
| M8 | `markAchievementSeen` / `justUnlocked` | API + function exist; zero frontend callers (dead code) | achievements API + `achievement-ui.tsx` |
| M9 | Dead component/file | `SectionPlaceholder` component and `src/lib/db/group-retention.ts` are unused | — |

## Known & suspected bugs

| # | Severity | Bug | Status | Evidence |
|---|---|---|---|---|
| B1 | Low | Check-in button/sleep answer resets to "Salvar check-in" after reload even when already checked in today | OPEN (UI only; data persists) | `checkinSaved`/sleep state client-only (`dashboard/page.tsx:112,584-594`), never re-derived from snapshot |
| B2 | Medium | Amigos DM may not recognize your own messages | SUSPECTED | `amigos/page.tsx:489` passes raw `user.uid`; app mandates normalized profile id for ownership comparisons (`grupos/page.tsx:669-673`, `salas-de-foco/page.tsx:361-363`); `isMe = msg.senderId === currentUserId` (`ChatThread.tsx:746`) |
| B3 | Low | Group chat whitespace below input bar on mobile (reported 3rd time) | OPEN | Composer + viewport sizing in `grupos/page.tsx` |
| B4 | Medium | Focus room pause/resume race (stale state between users) | OPEN | `focus-rooms.ts` pause/resume (:379-453) |
| B5 | High | Focus room join-by-code broken for new users | OPEN | Join-by-code path (M3) |
| B6 | Low | Focus room "leave while waiting" route is flawed, page guards to waiting screen | WORKAROUNDED | `salas-de-foco/page.tsx:627` |
| B7 | — | Achievement reward mint not in a transaction with per-tier grant | WATCH | unique-constraint idempotency OK; partial-mint risk on mid-query failure (`achievements.ts`) |
| B8 | Fixed | Aura reverting to Flame on reload | FIXED | server-first restore in both apps |
| B9 | Fixed | 2x XP potion also doubling coins | FIXED | coins via separate `addCoins`; `focus.ts:314-315`, `daily-quests.ts:645-646` |

## Bug history verification

Cross-check of previously reported issues against current code:

| Reported issue | Verdict | Evidence / test needed |
|---|---|---|
| Delete task in week planner reappears (race) | Not evidenced in code; manual test recommended | Optimistic filter + rollback `dashboard/page.tsx:366-375`; profile-scoped `DELETE` `weekly-plans.ts:186-190`; single guarded mount fetch (`page.tsx:152-194`, `cancelled` flag) |
| Check-in state not persisting across reload | Still broken (UI); data persists | B1 |
| Group chat whitespace below input (3rd report) | Still broken on mobile | B3 |
| 3-dots menu overlapping / detached | Mostly fixed | Trigger anchored to bubble edge `ChatThread.tsx:333-334` |
| Amigos chat not recognizing own messages | Likely present | B2 |
| Selected aura reverts to Flame after reload | Fixed | Server-first restore both apps |
| 2x XP potion also doubling coins | Fixed | B9 |

## Verification method

- Code review of `src/lib/db/*`, `src/app/**`, `src/components/chat/ChatThread.tsx`, `src/types/index.ts` (Sept 2026).
- `npx tsc --noEmit` passes. Pre-existing lint warnings in `focus-timer.tsx` (react-hooks/set-state-in-effect) are baseline, unrelated.
- **Runtime checks still needed**: B2 (send a DM on two devices from the same account), B5 (join a room by code with a fresh account), weekly-planner delete under slow network.
- **Deployment caveat**: the `paused_count` column and `flow_state` achievement seed require `npm run db:init` (or equivalent migration) on existing databases.