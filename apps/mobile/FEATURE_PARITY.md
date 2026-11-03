# EnergyOS mobile feature map

This is the porting inventory for the Expo client. The web application remains the
product and API source of truth; these screens must use HTTP endpoints and must not
access `src/lib/db`, PostgreSQL, or browser-only modules.

## Web-to-mobile coverage

| Web area | Web source | Mobile destination | Status |
|---|---|---|---|
| Sign-in, registration, password recovery | `src/app/(auth)/login`, `cadastro`; `src/lib/firebase.ts` | `src/app/(auth)/*`, `src/auth/` | Not implemented |
| Dashboard, check-in, daily tasks, habits, quests | `src/app/dashboard`; `src/components/dashboard/` | `src/app/(tabs)/index.tsx`, `src/features/dashboard`, `tasks`, `habits` | Navigation shell only |
| Planner (day/week/month), recurring plans | `src/app/planner`; `src/components/planning/`, `weekly-plan/` | `src/app/(tabs)/planner.tsx`, `src/features/planner` | Navigation shell only |
| Consistency, streaks, reports, recap | `src/app/dashboard/consistencia`, `src/app/relatorio`; recap components | `src/app/progress/*`, `src/features/progress` | Not implemented |
| Focus timer and rooms | `src/components/dashboard/focus-timer.tsx`, `src/app/salas-de-foco/` | `src/app/(tabs)/focus.tsx`, `src/features/focus` | Navigation shell only |
| Friends, public profiles, direct messages | `src/app/amigos/`, `src/app/perfil/[id]/`, `src/components/chat/` | `src/app/social/*`, `src/features/social` | Navigation shell only |
| Groups and group chat | `src/app/grupos/`, group/chat components | `src/app/social/groups/*`, `src/features/groups` | Not implemented |
| Goals and goal habits | `src/app/dashboard/`, goals components | `src/app/goals/*`, `src/features/goals` | Not implemented |
| Profile and settings | `src/app/perfil/`, `src/app/configuracoes/` | `src/app/(tabs)/profile.tsx`, `src/app/settings/*` | Navigation shell only |
| Achievements, store, garden, league | `src/app/perfil/`, `src/app/loja/`, `jardim/`, `liga/` | `src/app/rewards/*`, `src/features/rewards` | Not implemented |

“Navigation shell only” means the route and themed layout exist but do not yet
load or mutate user data. No product feature is considered complete until it uses
the authenticated API and handles loading, empty, error, and success states.

## Existing API entry points

The API authenticates with `Authorization: Bearer <Firebase ID token>` and resolves
the current account on the server. Representative existing endpoints:

| Mobile feature | Existing API |
|---|---|
| Dashboard | `GET /api/dashboard` |
| Check-in | `GET`, `POST /api/checkins` |
| Date-specific tasks | `GET`, `POST /api/tasks`; `POST /api/tasks/[id]/complete` |
| Recurring tasks / habits | `GET /api/daily-tasks`; `PATCH`, `DELETE /api/daily-tasks/[id]`; `GET`, `POST /api/habits/[id]/completions` |
| Goals | `GET`, `POST /api/goals`; `GET`, `POST /api/goals/[id]/habits` |
| Planner | `GET`, `POST /api/weekly-plans` and `/api/weekly-plans/series/*` |
| Personal focus | `GET`, `POST /api/focus` |
| Focus rooms | `/api/focus-rooms` and `/api/focus-rooms/[roomId]/*` |
| Profile / settings | `GET`, `PATCH /api/profile`; `GET`, `PUT`, `PATCH /api/settings` |
| Friends / direct messages | `/api/friends/*`, `/api/dm/[friendId]/*` |
| Groups / group messages | `/api/groups/*` |
| Achievements / store / garden / league | `/api/achievements`, `/api/store/*`, `/api/garden`, `/api/league` |
| Reports / consistency | `/api/insights`, `/api/relatorio`, `/api/streak-calendar` |

These are route families, not a substitute for checking each request and response
before implementing a client operation. Reuse server-calculated dates, progress,
rewards, permissions, and balances; never reproduce reward calculations on-device.

## Native integration gaps

- The API exposes focus start/end/history but no read operation for the currently
  active personal focus session. A session cannot be reliably restored after app
  suspension without a server contract change.
- Messaging and focus-room updates are HTTP polling flows, not a documented
  websocket/SSE protocol. The mobile app must use bounded polling and refresh.
- Current push subscriptions use browser Web Push/service workers; they do not
  register native APNs/FCM tokens.
- Web media paths use browser APIs and Cloudinary upload flows. Native selection,
  recording, and upload need an Expo-compatible adapter.
- Some route families have separate versions or overloaded responses; confirm the
  exact response shape and authorization behavior at each implementation slice.

## Delivery order

1. Auth restore and typed API transport.
2. Dashboard, check-in, tasks/habits, then focus.
3. Profile/settings, goals and planner.
4. Consistency/reports and reward surfaces.
5. Friends, groups, chat, rooms, native media/push and hardening.

The first native pass uses five bottom tabs: Hoje, Planejar, Foco, Social, Perfil.
Detail and secondary features belong in stack routes rather than overcrowding tabs.
