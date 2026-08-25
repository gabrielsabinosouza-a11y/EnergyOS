# EnergyOS — Project Status

> **Last updated:** 2026-08-24
> **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Recharts · Framer Motion · Firebase Auth · PostgreSQL (Neon)
> **Language:** Brazilian Portuguese

---

## Goal

A **personal productivity & wellness dashboard** — a single place to track sleep, study, training, energy, tasks, goals, and habits, with automatic weekly insights. One user, self-hosted or deployed, no bloat.

The name is a play on "operating system for your energy." The tagline: *Seu ritmo, com clareza* (Your rhythm, with clarity).

---

## What Exists Today

### Pages (6 routes)

| Route | What it does | Status |
|---|---|---|
| `/` | Landing page — hero, feature cards, phone mockup, CTA. Auto-redirects if logged in. | Done |
| `/login` | Email/password login, Google OAuth, password reset flow. | Done |
| `/cadastro` | Registration with name, email, password, confirm. Google OAuth. | Done |
| `/dashboard` | Main view — greeting, daily check-in (sleep hours), weekly metrics (sleep/study/training with trends), task list with full CRUD, progress bar, streak, latest insight. | Mostly done |
| `/metas` | Goals & habits — full CRUD on goals (title, category, target, frequency), progress ± buttons, expandable cards, habit creation & daily toggle. | Done |
| `/perfil` | Profile — avatar upload (Firebase Storage), name editing, member since, streak, auth provider. | Done |
| `/configuracoes` | Settings — name, notifications toggle, theme (system/light/dark), sleep/focus defaults, logout, delete account. | Done |
| `/relatorio` | Reports — Recharts visualizations: sleep line chart, study bar chart, task completion, goal progress by category, week-over-week comparison. 7d/30d toggle. | Done |

### Backend (all Next.js API routes, 15 endpoints)

Full CRUD for: tasks, goals, habits, check-ins, settings, profile. Plus aggregated endpoints for dashboard snapshot, weekly insights, and reports. All protected by Firebase token verification server-side.

### Database (8 tables)

`profiles` · `daily_checkins` · `tasks` · `goals` · `habits` · `habit_completions` · `user_settings` · `insights`

### Design System

Dark-first with a deep navy palette (`#07111f` background, `#71d4ff` cyan accent). Light theme supported via CSS custom properties. Five category colors: cyan (sleep), lavender (study), orange (training), mint (health), coral (focus).

---

## UI/UX Assessment

### What works well
- **Clean visual identity.** The dark navy + cyan accent palette is cohesive and distinctive. The custom CSS properties system makes theme switching trivial.
- **Consistent layout.** AppShell sidebar on desktop is predictable. Pages follow the same panel/card pattern.
- **Meaningful data display.** The reports page with Recharts is genuinely useful — trend lines, bar charts, week-over-week comparison.
- **Good micro-interactions.** Framer Motion on the landing page, loading states, empty states are all present.

### What needs attention
- **Check-in form is incomplete.** It only captures sleep hours. The database supports `study_minutes`, `training_minutes`, and `energy_score` (1–5) but there's no UI for any of them. This is the biggest UX gap — the core data input is underutilized.
- **Mobile experience is thin.** The sidebar is desktop-only (`lg:` breakpoint). On mobile there's no navigation — users are stuck on whatever page they land on after login.
- **No responsive navigation.** Needs a mobile hamburger menu or bottom tab bar.
- **`DM Mono` font never loads.** Referenced in the `.eyebrow` CSS class but never imported via Google Fonts — falls back to system monospace. Breaks the design intention.
- **Some UI primitives are unused.** `Modal`, `Input`, `Button`, `ProgressBar` from `ui.tsx` and `SectionPlaceholder` appear to be defined but not used by actual pages, which implement their own inline versions. Creates drift risk.
- **No loading skeletons.** Pages show a spinner (`LoadingState`) but no skeleton screens — feels abrupt on slow connections.
- **Streak display is modest.** The streak is a small number in the sidebar/header. For a productivity app, this is a key motivational element that deserves more visual weight.

---

## What's Missing

### Critical
- [ ] **Server-side route protection is not wired.** `src/proxy.ts` exports a middleware function and config, but there is no `src/middleware.ts` file. Route protection is entirely client-side via `useAuthRedirect()`, which can be bypassed.
- [ ] **Mobile navigation.** No way to navigate between pages on screens < `lg:` breakpoint.
- [ ] **Check-in form expansion.** Study minutes, training minutes, and energy score have database + API support but no UI.

### Important
- [ ] **`bestStreak` is incorrect in reports.** `/api/relatorio` sets `bestStreak = currentStreak` with a comment "Would need historical tracking." Needs a proper calculation or a `best_streak` column.
- [ ] **Notifications are a dead toggle.** The setting saves to the database but nothing reads it or sends notifications. Either implement notifications or remove the toggle to avoid misleading users.
- [ ] **Duplicate code.** `src/lib/goals-service.ts` is an older version superseded by the modular `src/lib/db/goals.ts`, `habits.ts`, and `settings.ts`. Should be deleted.
- [ ] **Cloudinary and Resend** are in `.env.example` but no code uses them. Either implement features for them or remove the references.

### Nice-to-have
- [ ] **No tests exist.** No test files, no test config, no testing libraries. The debugging guide has manual checklists but nothing automated.
- [ ] **No error boundaries.** React error boundaries would catch render crashes gracefully instead of white-screening.
- [ ] **No offline support.** A service worker or basic caching would help on flaky connections.
- [ ] **No data export.** Users can't export their data as CSV/JSON.
- [ ] **Landing page could be sharper.** The phone mockup is static. An interactive demo or animated walkthrough would be more compelling.
- [ ] **`apps/server/` is an empty shell.** Contains only an empty `.env`. Should be either implemented or removed to avoid confusion.
- [ ] **`next.config.ts` is empty.** Missing image domain config (though currently worked around by using raw `<img>` tags).

---

## Architecture Notes

- **Auth:** Firebase Auth (email/password + Google OAuth). ID tokens verified server-side via Google Identity Toolkit public endpoint. Profile IDs are Firebase UIDs hashed to UUID format for PostgreSQL.
- **Database:** PostgreSQL via `pg` connection pool. All queries use parameterized inputs. Strict validation parsers on every API endpoint (`lib/db/validation.ts`).
- **No ORM.** Raw SQL everywhere. Keeps things transparent but means schema changes require manual query updates.
- **Timezone handling:** All date logic goes through `lib/db/dates.ts` which uses `America/Sao_Paulo`. The app assumes a single timezone for all operations.
- **Streak logic:** A day counts toward the streak if ≥ 50% of its tasks are completed. Days with no tasks are ignored (don't count or break).
- **Insights:** Auto-generated weekly comparisons (current week vs. previous) for sleep, study, training, and task consistency. Stored in the `insights` table.

---

## File Map

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── page.tsx            # Landing page
│   ├── dashboard/page.tsx  # Main dashboard
│   ├── metas/page.tsx      # Goals & habits
│   ├── perfil/page.tsx     # Profile
│   ├── configuracoes/      # Settings
│   ├── relatorio/page.tsx  # Reports
│   ├── (auth)/             # Login + registration
│   └── api/                # All backend endpoints (15 routes)
├── components/
│   ├── app-shell.tsx       # Sidebar + content layout
│   ├── navigation.tsx      # Sidebar + Header
│   ├── dashboard.tsx       # MetricCard, TaskProgress, etc.
│   └── ui.tsx              # Card, Button, Input, Modal (mostly unused)
├── lib/
│   ├── db/                 # All database operations (10 modules)
│   ├── auth-context.tsx    # Firebase auth React context
│   ├── server-auth.ts      # Token verification
│   ├── api-client.ts       # Frontend fetch wrapper
│   ├── theme-provider.tsx  # Light/dark/system
│   └── goals-service.ts    # ⚠️ DEAD CODE — delete this
├── types/index.ts          # All TypeScript interfaces
├── db-schema.sql           # Full PostgreSQL schema
└── globals.css             # Design system (CSS custom properties)
```

---

## Environment Variables

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | Firebase client config | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `AUTH_ALLOW_UNVERIFIED` | Dev bypass for auth (set in `.env`) | Dev only |
| `CLOUDINARY_*` (3 vars) | Image uploads | **Not used in code** |
| `RESEND_API_KEY` | Email service | **Not used in code** |
| `NEXT_PUBLIC_APP_URL` | App base URL | Used |
