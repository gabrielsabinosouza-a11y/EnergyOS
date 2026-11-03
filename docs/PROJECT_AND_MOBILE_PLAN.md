# EnergyOS: Project Guide and React Native Mobile Plan

**Purpose:** Give contributors and Claude a current, code-grounded description of EnergyOS, its implementation status, and a practical plan for adding a React Native app.

**Snapshot date:** 2026-11-03

**Product language:** Brazilian Portuguese (`pt-BR`)

**Recommendation:** Add an Expo/React Native app to this repository as a new workspace. Keep the existing web app and backend where they are; do not begin by moving or rewriting them.

> This document reflects the repository structure and code inspected on the snapshot date. `PROJECT_STATUS.md` and `STATUS.md` contain useful earlier reviews, but their status sections are dated August/September 2026; re-check any listed issue before treating it as still open.

## 1. What EnergyOS is

EnergyOS is a Portuguese-language personal productivity and wellbeing product: it helps a person organize their day, track energy and routines, and build consistency without making productivity feel punitive. Its visual identity is dark, atmospheric, and game-like, with cyan, purple, green, orange, and coral accents.

The central product loop is:

1. Check in and see today's energy, tasks, habits, and plan.
2. Complete useful work, focus sessions, or routine activities.
3. Receive progress, streak, XP, coins, quests, and achievements.
4. Review personal trends and use them to plan the next day or week.

The product has grown beyond a personal dashboard. It now includes planning, game rewards, leaderboards, focus rooms, groups, friends, and direct messages. That breadth is valuable, but it means the native app should be delivered in coherent slices instead of attempting a feature-for-feature port immediately.

## 2. Current implementation at a glance

| Area | Current implementation |
|---|---|
| Web client | Next.js App Router, React, TypeScript, Tailwind CSS v4 |
| Web/API runtime | One Next.js application; API handlers live under `src/app/api` |
| API surface | 120 `route.ts` handler files at this snapshot |
| Authentication | Firebase Authentication in the client; server handlers verify Firebase ID tokens |
| Product database | PostgreSQL through `pg`; the deployed database is Neon |
| Data access | Server-only modules under `src/lib/db`; parameterized SQL, no application ORM |
| File/media uploads | Chat media uploads directly from the web client to Cloudinary |
| Web notifications | Browser service worker/Web Push code exists; native push is a separate integration |
| Tests | Node's test runner with `tsx`; unit and API-route tests are listed in `package.json` |
| Package manager | npm with a root `package-lock.json` |
| Native mobile | Not present yet: no Expo/React Native app or workspace is currently configured |

The web project is a substantial application, not a clean starter template. The root `package.json`, Next configuration, environment setup, database scripts, and web routes are already established. Avoid reorganizing those as a prerequisite for mobile.

### Main user-facing areas present in the code

- **Account:** landing page, sign-in, registration, auth callback, profile, and settings.
- **Daily routine:** dashboard, check-ins, tasks, recurring daily tasks/habits, goals, streak, and consistency history.
- **Planning:** weekly plans, recurring plans, calendar/planner views, and Kanban.
- **Focus:** personal focus timer and collaborative focus rooms.
- **Progress/rewards:** XP, coins, quests, achievements, shields, store, garden, league, and monthly recap.
- **Social:** friends, direct messages, groups, group messages, and public profiles.
- **Reports:** insights and reports.

The route list is a better source of current page coverage than old status documents. At this snapshot, the app has 18 `page.tsx` files and the API has 120 route handlers, including nested and parameterized routes.

## 3. Repository map

```text
src/
  app/
    (auth)/                 # Login and registration
    api/                    # Next.js HTTP API handlers (120 route.ts files)
    dashboard/              # Daily dashboard and consistency history
    planner/                # Calendar / planning views
    salas-de-foco/          # Focus rooms
    amigos/                 # Friends and direct messages
    grupos/                 # Groups and group conversations
    liga/, loja/, jardim/   # League, store, garden
    perfil/, configuracoes/ # Profile and settings
    relatorio/              # Reports
  components/
    chat/, dashboard/, planning/, recap/, weekly-plan/, xp-boost/
  lib/
    db/                     # PostgreSQL query and domain modules
    planning/, recap/       # Pure feature logic
    api-client.ts           # Web API client and Firebase token attachment
    auth-context.tsx        # Web Firebase auth context
    server-auth.ts          # Server-side token verification and user resolution
    db.ts                   # PostgreSQL pool
  types/                    # Shared web/domain TypeScript types
  db-schema.sql             # PostgreSQL schema initialization source
migrations/                 # Incremental SQL migrations
scripts/                    # Database, verification, seed, and E2E scripts
docs/                       # Product and technical documentation
```

`src/lib/db/*` is server-side implementation, not a mobile SDK. A native app must call the HTTP API; it must never import database modules or connect to Postgres directly.

## 4. Architecture and data boundaries

### Request flow

```text
Web browser or native app
  -> Firebase Authentication
  -> HTTPS API request authenticated with the Firebase ID token
  -> Next.js API route
  -> requireAuth() verifies token and resolves profile identity
  -> feature module in src/lib/db/
  -> PostgreSQL / Neon
```

The web API client currently uses relative URLs and obtains an ID token with Firebase's `currentUser.getIdToken()`. A mobile client will need a configured absolute API base URL (for example, production API URL plus a development URL); it must not copy the browser's relative-fetch assumption.

### Authentication and ownership rules

- Use the existing Firebase project and Firebase Authentication unless a separate migration is explicitly approved. Do not introduce a second identity provider just for mobile.
- Native requests should use standard HTTP bearer authentication with the current Firebase user's ID token.
- API handlers call `requireAuth()` and derive the caller's profile identity on the server. Client-provided profile IDs are not proof of identity.
- The browser's `energyos_session` cookie and Next.js `proxy.ts` are web navigation mechanisms. They are not the mobile authentication protocol; a native client should use Firebase auth state and handle API `401` responses.
- Never ship `DATABASE_URL`, database credentials, admin credentials, or other server secrets in the app bundle. The app talks only to the API.
- Keep account ownership checks and authorization in the server. Mobile UI visibility is not an authorization boundary.

### API conventions and data rules

- Route handlers are the existing product API. Prefer extending them over adding a second backend for mobile.
- Most endpoints return JSON and use `{ error: string }` for errors. `src/lib/http.ts` centralizes common response/error handling.
- `src/lib/api-client.ts` is the current web API catalog and gives examples of request/response shapes. It imports types from `src/types`; use it as an inventory, not as a React Native dependency.
- The dashboard endpoint (`GET /api/dashboard`) returns a combined snapshot and is a good starting point for the mobile home screen.
- Dates used for product-day calculations are `YYYY-MM-DD` in `America/Sao_Paulo`. Use server-returned date keys and keep this timezone rule; do not replace it with UTC date slicing or device-local midnight.
- XP awards are centralized and recorded idempotently through the XP ledger. The client should request an action and render the server's result; it must not calculate or mint authoritative XP, coins, streaks, or rewards itself.
- Existing PostgreSQL and migrations remain the source of truth. Do not run `db:init`, migrations, data resets, or seed scripts as part of ordinary mobile work.

### Features that need native-specific work

- **Media:** `src/lib/media.ts` uses browser `File`, `XMLHttpRequest`, and web-oriented upload behavior. Native image/video/audio selection and upload need an Expo-compatible adapter; preserve existing file limits and server validation.
- **Push notifications:** existing code is based on browser service workers and Web Push subscriptions. Native push requires a native token registration and delivery plan (typically through Expo Push Service or FCM/APNs) plus server-side support. Do not claim the web push endpoint works for native tokens without verifying it.
- **Focus timer:** background execution differs across iOS and Android. Treat the server as authoritative for session state; use native local notifications only as a user-facing aid. Do not rely on a JavaScript timer running continuously while the OS suspends the app.
- **Realtime/chat:** chat and focus-room HTTP functionality exists, but do not assume there is a stable native websocket/realtime contract. Verify current behavior and API contracts before promising live updates; use a documented polling/refresh strategy as an initial fallback if necessary.
- **Offline mode:** no general offline-first data layer is established. Start online-first. Add local persistence or queued writes only for a defined feature and explicit conflict behavior.

## 5. Is a monorepo worthwhile?

### Recommendation: yes, with a deliberately small first step

This product already has a large web client and backend in one repository. A native app will use the same authentication provider, the same API, the same product vocabulary, and a number of the same stable TypeScript contracts. An npm-workspaces monorepo can keep those changes discoverable and make coordinated API/mobile changes easier.

The recommendation is **not** to move the existing Next.js app into `apps/web` now, nor to force web and mobile to share UI components. Keep the web app at the repository root at first and add `apps/mobile`. Extract shared packages only when actual duplication appears and the contract is stable.

| Monorepo benefits for EnergyOS | Costs and risks |
|---|---|
| Web and mobile API changes can be reviewed and released together. | CI, dependencies, and repository tooling become more involved. |
| One place for product docs, issues, and contributor instructions. | The existing web project is large; a premature directory migration can break Next paths, aliases, deployment, or environment setup. |
| A future contracts package can prevent web/mobile API types from drifting. | Sharing too much couples the apps and can force browser-only code into native builds. |
| Easier coordinated bug fixes across clients and API. | Native builds add Expo/EAS, simulator/device, signing, and platform-specific operational work. |

### When a separate repository would be better

Choose a separate mobile repository if mobile has an independent team/ownership model, needs separate access controls, release cadence, or open-source lifecycle, or if you intentionally want no shared code and accept manual API-contract coordination. None of those requirements is evident in the current repository, so separate repos would add coordination overhead without a clear current advantage.

### Safe monorepo evolution

1. Keep the current root web app, root Next config, `src/`, migrations, and root npm lockfile in place.
2. Add `apps/mobile` as an Expo app and configure npm workspaces with the smallest possible manifest change.
3. Start with the existing HTTP API and local app-owned TypeScript types.
4. Once mobile endpoints and payloads are understood, extract only stable, framework-independent contracts or pure utilities into `packages/contracts` (or `packages/domain`).
5. Move the web app to `apps/web` only if a later operational need justifies a separate, tested migration. It is not required for a monorepo.

Do not share React components between Next.js and React Native. Their layout, navigation, accessibility, input, animation, and platform APIs differ. Share only well-bounded TypeScript types, schemas, API contract tests, or pure business functions that have no browser, Node, React, or database dependency.

## 6. Proposed React Native app

### Technology and operating constraints

- **React Native with Expo's managed/CNG workflow**, TypeScript, and Expo Router.
- **No authored Kotlin, Java, or Android Studio work.** Use Expo configuration and supported config plugins for native capabilities.
- Use Expo Go only for features it supports. A development build may be necessary for native modules, push notifications, or other custom native capabilities.
- Use EAS Build in the cloud for installable Android/iOS builds; test on physical devices and simulators where available. Android Studio is not needed as the development workflow, although platform build services still compile native projects behind the scenes.
- A truly native app cannot guarantee that no generated Android/iOS files or native configuration exist during builds. The constraint here is that contributors should not maintain or write Kotlin/Java or require Android Studio.
- Keep the package manager consistent with this repository (npm) unless there is a documented reason to change it.

### Suggested initial structure

```text
apps/
  mobile/
    app/
      _layout.tsx
      (auth)/
        sign-in.tsx
        sign-up.tsx
        forgot-password.tsx
      (tabs)/
        _layout.tsx
        index.tsx             # Home / dashboard
        planner.tsx
        progress.tsx
        profile.tsx
      tasks/
      goals/
      focus/
      settings/
    src/
      features/
        auth/
        dashboard/
        tasks/
        habits/
        goals/
        planner/
        focus/
        rewards/
        social/
      shared/
        api/                  # Base URL, auth-aware fetch, errors
        components/
        hooks/
        types/
        validation/
      auth/                   # Firebase native SDK setup and auth state
      storage/                # Secure, minimal device persistence
      theme/                  # Native design tokens
      notifications/          # Native push/local notification adapter
    assets/
    app.config.ts
    package.json
    tsconfig.json
    README.md
packages/                     # Add only after a real sharing need exists
  contracts/                  # Pure types/schemas; no React or platform imports
```

This is a target shape, not a demand to create every directory in the first commit. Begin with authentication, API transport, navigation, and the dashboard vertical slice.

### Navigation and user experience

- Use a native bottom-tab layout for the main areas and stack navigation for detail/edit flows.
- Keep the EnergyOS visual language, but redesign screens for touch, safe areas, keyboard behavior, and small displays. Do not port Tailwind classes or desktop sidebar layouts into React Native.
- Start with dark mode, consistent spacing/type/color tokens, accessible contrast, minimum touch targets, loading/empty/error states, and clear offline/network messaging.
- Keep the app's primary flow fast: launch → authenticated dashboard → complete a daily action without navigating through many screens.
- Preserve `pt-BR` labels and use locale-aware display formatting while retaining the backend's date format/timezone rules.

### Authentication and API client

Build one mobile API layer that:

1. Resolves the latest Firebase ID token for the signed-in user for each request (refresh through the SDK as needed).
2. Uses a configured HTTPS API base URL, with separate development and production configuration.
3. Adds the current Firebase ID token to authenticated requests and JSON headers where appropriate.
4. Converts API error responses into typed errors and exposes `401`, validation, rate-limit, server, and network failures distinctly.
5. Avoids logging tokens or sensitive request data.
6. Supports cancellation/timeouts and bounded retries only for safe, retryable requests. Do not blindly retry non-idempotent writes.

Use the Firebase-supported React Native integration compatible with Expo and verify its current setup instructions before implementing. Do not copy the web-only `auth-context.tsx`, `window`, cookie, or `localStorage` code into the native app. Any token persistence should be handled by the supported SDK/secure storage integration, not custom plaintext storage.

### First delivery scope

**MVP / first vertical slice**

- Firebase sign-in, sign-up, password reset, sign-out, and auth restoration.
- Native navigation and the EnergyOS theme foundation.
- Dashboard snapshot and daily check-in.
- Daily task/habit list with completion and server-confirmed rewards/progress.
- Focus timer with reliable foreground behavior and correct server synchronization.
- Profile/settings basics and a usable loading/error/empty state for every initial screen.

**Next delivery**

- Goals and progress history.
- Weekly planner and recurring item support.
- Reports/consistency calendar and more reward surfaces.
- Native notification registration and reminder delivery after its server contract is designed.

**Later / deliberate expansion**

- Store/garden/achievements and league.
- Friends, DMs, groups, and focus rooms. These are valuable but bring media, moderation, background, synchronization, and realtime complexity; port after the core daily loop is stable.

Sequence may change based on user feedback, but avoid putting every web feature into the first mobile release.

## 7. Delivery plan and acceptance criteria

### Phase 0 — validate the contract

- Run the current web app and inspect the dashboard response and its authenticated routes.
- Confirm production/development API origins and Firebase project configuration without copying secrets into source control.
- Write down actual request/response shapes for the MVP endpoints and check behavior on expired tokens and network failures.
- Confirm existing web app and migrations remain untouched by the mobile bootstrap.

**Done when:** a developer can describe the auth flow, configure the mobile app against a development API, and make an authenticated read-only dashboard request.

### Phase 1 — workspace and shell

- Add `apps/mobile` and npm workspace support without relocating the current web project.
- Create Expo app config, TypeScript setup, Expo Router root, theme tokens, and tab/stack navigation.
- Establish environment handling and documented local device testing.

**Done when:** mobile launches on an Android device using the supported Expo workflow, navigation works, and the existing web dev/build commands still work.

### Phase 2 — authenticated daily loop

- Add Firebase auth and the mobile API client.
- Implement dashboard, check-in, tasks/habits, and focus timer in small end-to-end slices.
- Keep reward/streak state server-authoritative; verify retries and duplicate taps do not duplicate rewards.

**Done when:** a user can authenticate on device, load their own data, complete an action, see server-confirmed state after refresh, and sign out safely.

### Phase 3 — harden and broaden

- Test Android and iOS device layouts, accessibility, app resume, expired sessions, slow/offline network, and time boundaries around midnight in São Paulo.
- Add goals/planner, then the selected social/reward features.
- Add native push and media only after the backend integration and privacy requirements are agreed.
- Add shared API contracts when they reduce demonstrated drift; do not extract speculative packages.

**Done when:** each feature has end-to-end API coverage or focused client tests, documented limitations, and a verified release build.

### Quality bar for every mobile slice

- Does not regress web commands or behavior.
- No direct database access or server secrets in the client.
- Has typed loading, empty, success, and failure states.
- Handles `401`, flaky connections, repeated taps, and app resume.
- Treats server responses as authoritative for persisted product state and rewards.
- Uses the EnergyOS timezone contract for dates.
- Has basic unit/contract tests where logic is nontrivial and is manually checked on a device for native interaction.

## 8. Current project health and risks

### Positive signals

- A broad set of product features and a substantial API already exist, so mobile does not need a second backend.
- The web client already centralizes many API operations in `src/lib/api-client.ts`.
- Server-side identity resolution and PostgreSQL modules give the app a clear security/data boundary.
- A test runner and multiple focused tests are configured; database verification and E2E scripts are also present.
- Date utilities explicitly encode the product's `America/Sao_Paulo` day semantics.

### Risks to manage

- **Large feature surface:** porting everything at once would delay a useful mobile release. Ship the daily loop first.
- **Historical status docs:** `STATUS.md` has a September 2026 review and `PROJECT_STATUS.md` an August 2026 review. Their known-bug lists are leads for re-verification, not a live issue tracker.
- **Browser-specific code:** cookies, `window`, `localStorage`, service workers, DOM media APIs, CSS, and relative URLs need native adapters rather than direct reuse.
- **Native push/media:** existing web integrations do not imply native support.
- **API consistency:** the web API client and server types are not yet a formal published contract package. Avoid importing broad web modules into the mobile bundle.
- **Database change risk:** the schema and migrations are extensive. Prefer existing endpoints; any required migration must be reviewed, independently tested, and deployed safely.
- **Monorepo overhead:** preserve root Next behavior and lockfile discipline; don't add Turborepo or relocate the app until a measured need exists.
- **Feature maturity:** older `STATUS.md` review called out partial focus-room and social flows, including join-by-code and group UX gaps. Re-test those before including them in a mobile milestone.

No estimate of implementation time or ROI is claimed here; it depends on team capacity, supported platforms, release ambitions, and how much of the social feature set is in the first release. The architectural recommendation is about reducing coordination and contract drift, not a guarantee of commercial return.

## 9. Instructions for Claude and other coding agents

Use this document as orientation, not as a substitute for inspecting the current code. Before implementing:

1. Inspect the live implementation and the directly relevant tests; older status text may be stale.
2. Keep changes scoped to the requested feature and preserve the current web app unless a migration is explicitly requested.
3. For mobile work, use React Native + Expo + TypeScript. Do not create or require Kotlin, Java, or Android Studio workflows.
4. Keep API and Postgres ownership on the server. Never add a mobile database connection, credentials, or authoritative client-side reward logic.
5. Use Firebase ID tokens for API auth and let the server resolve the current user's profile. Never use a caller-supplied profile ID as proof of identity.
6. Preserve `America/Sao_Paulo` date calculations and server-defined API behavior.
7. Prefer a small working vertical slice over scaffolding every feature. Share pure contracts only when there is a real, stable reuse case.
8. Follow the repository's existing npm scripts and tests. Do not run destructive database scripts or change schema/data without explicit approval.
9. Keep secrets out of docs, logs, commits, and client bundles; use environment examples/placeholders only.
10. If changing Next.js code, follow the repository's `AGENTS.md` instruction to consult the installed Next.js documentation for this version before editing.

## 10. Useful commands

The exact scripts are defined in the root `package.json`; current common commands include:

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Database scripts such as `npm run db:init`, migrations, seed scripts, and reset/wipe scripts can change persistent data. Read the script and confirm the target database before running one.

## Related documentation

- [`README.md`](../README.md) — entry point and setup notes.
- [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) and [`STATUS.md`](../STATUS.md) — historical implementation reviews; check their dates.
- [`docs/data-access-rules.md`](data-access-rules.md) — ownership and query-scoping expectations.
- [`src/lib/api-client.ts`](../src/lib/api-client.ts) — web API methods and request shapes.
- [`src/lib/server-auth.ts`](../src/lib/server-auth.ts) — server token validation and profile resolution.
- [`src/lib/db/dates.ts`](../src/lib/db/dates.ts) — canonical date/timezone helpers.
