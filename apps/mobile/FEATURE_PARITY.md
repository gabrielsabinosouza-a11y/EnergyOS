# EnergyOS mobile feature map

This is the porting inventory for the Expo client. The web application remains the
product and API source of truth; these screens must use HTTP endpoints and must not
access `src/lib/db`, PostgreSQL, or browser-only modules.

## Web-to-mobile coverage

| Web area | Web source | Mobile destination | Status |
|---|---|---|---|
| Sign-in, registration, password recovery | `src/app/(auth)/login`, `cadastro`; `src/lib/firebase.ts` | `src/app/(auth)/*`, `src/auth/` | Email/password, auth restore, reset, and sign-out implemented; Google pending native integration |
| Dashboard, check-in, daily tasks, habits, quests | `src/app/dashboard`; `src/components/dashboard/` | `src/app/(tabs)/index.tsx` | Dashboard, check-in, date-specific task completion, habit creation and progress implemented; habit history/editing and quests pending |
| Planner (day/week/month), recurring plans | `src/app/planner`; `src/components/planning/`, `weekly-plan/` | `src/app/(tabs)/planner.tsx` | Weekly plans load, create, complete, and delete through the API; month/day calendar and recurring-series controls pending |
| Consistency, streaks, reports, recap | `src/app/dashboard/consistencia`, `src/app/relatorio`; recap components | `src/app/(tabs)/more/reports.tsx` | Recent report metrics, streak calendar summary, and weekly comparison implemented; monthly recap pending |
| Focus timer and rooms | `src/components/dashboard/focus-timer.tsx`, `src/app/salas-de-foco/` | `src/app/(tabs)/focus.tsx` | Personal session start/end/history, room list/create, and code-based join implemented; room controls and reliable active-session restoration pending |
| Friends, public profiles, direct messages | `src/app/amigos/`, `src/app/perfil/[id]/`, `src/components/chat/` | `src/app/(tabs)/social.tsx`, `src/app/(tabs)/more/dm/[friendId].tsx` | Search, friend requests, and text DMs implemented with bounded polling; public profile details, media, and richer message actions pending |
| Groups and group chat | `src/app/grupos/`, group/chat components | `src/app/(tabs)/social.tsx`, `src/app/(tabs)/more/groups/[id].tsx` | Group list/create and text chat implemented with bounded polling; invite/member/leaderboard management pending |
| Goals and goal habits | `src/app/dashboard/`, goals components | `src/app/(tabs)/more/goals.tsx` | Goal creation and server-confirmed progress logs implemented; goal habit management pending |
| Profile and settings | `src/app/perfil/`, `src/app/configuracoes/` | `src/app/(tabs)/profile.tsx`, `src/app/(tabs)/more/settings.tsx` | Profile display name, account sign-out, and persisted notification/theme/routine preferences implemented; photo/avatar customization pending |
| Achievements, store, garden, league | `src/app/perfil/`, `src/app/loja/`, `jardim/`, `liga/` | `src/app/(tabs)/more/{achievements,store,garden,league}.tsx` | Achievement progress/highlights, decoration and shield purchases, garden view, and current league standings implemented |

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
  websocket/SSE protocol. The mobile app uses bounded 15-second polling for
  conversations and pull-to-refresh; there is no background polling.
- Current push subscriptions use browser Web Push/service workers; they do not
  register native APNs/FCM tokens.
- Web media paths use browser APIs and Cloudinary upload flows. Native selection,
  recording, and upload need an Expo-compatible adapter.
- Mobile group chat must not expose camera, video-call/recording, or audio/voice
  controls or icons; keep those options out when the chat UI is implemented.
- Some route families have separate versions or overloaded responses; confirm the
  exact response shape and authorization behavior at each implementation slice.
- Native Google Sign-In requires a custom native module and therefore a development
  build; Expo Go cannot run the provider package. Build and OAuth client setup must
  be configured before this flow can be tested.

## Mobile navigation

The app uses five bottom tabs: Hoje, Planejar, Foco, Social, and Perfil.
Secondary screens (goals, reports, achievements, league, store, garden,
settings, and conversations) are nested in the authenticated stack so the tab
bar remains focused on daily use.
