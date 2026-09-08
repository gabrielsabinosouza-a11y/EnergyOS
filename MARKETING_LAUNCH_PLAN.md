# EnergyOS — Launch Plan: Fix Bugs & Security → Marketing → Google Analytics

> **Status:** Draft v1 — working document that we execute step by step.
> **Sources:** `SECURITY_AUDIT.md` (security), `STATUS.md` (bug matrix), `PROJECT_STATUS.md` (UX gaps) — check those for details.
> **Goal:** get the app to a stable, secure, privacy-compliant state → then do marketing → then connect Google Analytics (GA4) to measure it.

---

## How to use this document

Work top-to-bottom. Each phase is a **gate**: don't start marketing/GA until the phases above it are checked off. Manual (ops) steps are marked **MANUAL** — they cannot be fixed from the codebase.

Legend: `[ ]` to-do · `[x]` done · **(MANUAL)** operator action · **(BUG)** code fix · **(OPS)** infrastructure/process.

---

## Phase 0 — Security & data-integrity blockers (do FIRST)

These are the known open security items. Until they're done, we should **not** do heavy marketing (a leak would sink the launch).

- [ ] **(MANUAL) Rotate credentials** — `CLOUDINARY_API_SECRET` and the Neon DB password lived in `.env.example` in plaintext on a public repo. Treat them as exposed. Generate new ones, update `.env`, update Vercel env vars, delete the old ones. *(Source: SECURITY_AUDIT M2)*
- [ ] **(MANUAL) Deduplicate `xp_ledger` + apply schema migration** — production DB still has the old schema and **6 duplicate reward groups**. Run the dedupe SQL (SECURITY_AUDIT §M14), then `npm run db:init`. The migration **will fail** until duplicates are removed.
- [ ] **(OPS) Set `CRON_SECRET`** in production and point the focus-rooms cleanup scheduler at it (`x-cron-secret` header). The cleanup endpoint already rejects unauthenticated callers. *(SECURITY_AUDIT M12, H4)*
- [ ] **(OPS) Verify rate-limiter expectations on Vercel** — the in-memory limiter is per-instance. Fine for one instance; if we scale, move to Upstash/Redis. *(SECURITY_AUDIT H4)*
- [ ] **(OPS) Confirm `AUTH_ALLOW_UNVERIFIED=false`** in production `.env`/Vercel (dev-only bypass must not ship).

**Gate: all of Phase 0 done before proceeding to Phase 2+.**

---

## Phase 1 — Fix the remaining bugs (code)

### 1.1 Known open bugs (from `STATUS.md`)

- [ ] **(BUG) B1 — Check-in UI doesn't persist on reload** — button/sleep answer resets to "Salvar check-in" even when already checked in. Data is safe; re-derive state from the snapshot on load. `dashboard/page.tsx`
- [ ] **(BUG) B2 — Amigos DM may not recognize your own messages** — ownership compare must use the normalized profile id (`myProfileId`), not the raw `user.uid`. Verify on two devices/sessions. `amigos/page.tsx:489`, `ChatThread.tsx`
- [ ] **(BUG) B3 — Group chat whitespace below input on mobile** (reported 3×) — fix composer + viewport sizing. `grupos/page.tsx`
- [ ] **(BUG) B4 — Focus room pause/resume race** — stale state between users. `focus-rooms.ts`
- [ ] **(BUG) B5 — Focus room join-by-code broken for new (non-member) users** — highest-priority social bug. `focus-rooms.ts`, `salas-de-foco/page.tsx`
- [ ] **(BUG) B6 — Focus room "leave while waiting" is flawed** — page currently guards to a waiting screen (workaround). Clean up. `salas-de-foco/page.tsx:627`
- [ ] **(BUG) B7 — Achievement reward mint not transactional** — wrap per-tier grant in a transaction with the unique-constraint idempotency. `achievements.ts`

### 1.2 Missing features that block a good first impression (from `STATUS.md` M-list)

Pick the ones that matter for marketing; the rest can ship later.

- [ ] **(BUG) M5 — Group "create with usernames"** — SQL has a bug, never wired to UI. Fix or hide the entry point. `groups.ts`
- [ ] **(BUG) M6 — Group pinned-message expiry** — pins never expire despite the schema supporting `pinnedUntil`. `ChatThread.tsx`
- [ ] **(BUG) M3 — Focus room join-by-code** (same as B5).
- [ ] **(BUG) M4 — Group kick/unmute/unban not reachable from UI** — backend exists; wire the member menu. `grupos/page.tsx`
- [ ] **(FEATURE) M1 — 3 of 4 group achievements** — only "Sincronia" exists. Nice for retention marketing; can defer.
- [ ] **(FEATURE) M2 — Shield-design purchase/equip UI** — backend ready, no UI. Small win in the Loja.
- [ ] **(CLEANUP) M8/M9 — `markAchievementSeen` dead code, unused components/files** — remove before launch. (`SectionPlaceholder`, `group-retention.ts`, `goals-service.ts`)

### 1.3 Already fixed this working session (verify in a quick regression pass)

- [ ] Auto-scroll to bottom on chat open (Amigos + Grupos) — `ChatThread.tsx`
- [ ] Optimistic message sending (instant render, no >0.5s wait) — `amigos/page.tsx`, `grupos/page.tsx`
- [ ] Onboarding: icons from `/Onboard/`, fast image transitions — `onboarding-tour.tsx`
- [ ] Profile "dados pessoais" bed icon size — `perfil/page.tsx`

**Gate: every checkbox above is either fixed or consciously deferred in writing (with a reason).**

---

## Phase 2 — Security hardening leftovers (recommended before showing off)

From `SECURITY_AUDIT.md` "Remaining recommendations":

- [ ] Consider `firebase-admin` + `verifyIdToken()` — removes the Google API round-trip and adds full signature/audience validation (currently `accounts:lookup`).
- [ ] Re-check the allowed image remote hosts (`images.remotePatterns`) before launch — add any new host (avatars) to the allowlist, never `*`.
- [ ] Run a final secrets scan: `grep -rEI "(api[_-]?key|secret|password|postgresql://)" --exclude-dir=.git --exclude-dir=node_modules .` and confirm `.env*` are git-ignored.
- [ ] Confirm no debug/`/api/test` reachable in production (test route returns 404 in prod — verify once deployed).

---

## Phase 3 — Performance & UX basics (gate for "looks professional")

- [ ] **Core Web Vitals** — run Lighthouse (Chrome DevTools) on `/`, `/login`, `/dashboard`; target CLS < 0.1, LCP < 2.5s, INP < 200ms.
- [ ] **Mobile navigation** — without it, mobile users get stuck; fix the sidebar → bottom tab/hamburger. `app-shell.tsx`
- [ ] **DM Mono font actually loads** — either import via Google Fonts or remove the reference. `globals.css`
- [ ] **Loading skeletons** instead of spinners for main pages (dashboard, relatorio).
- [ ] **Error boundaries** — no white-screens on render crashes.
- [ ] **Landing page sharper** — interactive demo or animated walkthrough (the phone mockup is static). This is the first thing marketing shows.
- [ ] **SEO basics** — title/meta description per page, `metadata` export, canonical URLs, OG image for social sharing, `robots.txt`, `sitemap.xml`.
- [ ] **Verify analytics-free production build is clean**: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## Phase 4 — Legal & trust (REQUIRED before Google Analytics)

GA4 collects personal data. We need consent + privacy docs **before** the tag goes live.

- [ ] **Privacy Policy (Política de Privacidade)** — PT-BR page (`/privacidade`), covers: what we collect (profile, check-ins, chat, analytics), why, storage (Firebase, Neon, Cloudinary), data deletion, LGPD rights (Acesso, Correção, Exclusão, Portabilidade), contact.
- [ ] **Terms of Service (Termos de Uso)** — PT-BR page (`/termos`).
- [ ] **Cookie/Consent banner** — because GA4 uses cookies/identifiers; implement a lightweight consent gate (see Phase 5). Don't load analytics until the user accepts.
- [ ] Put links to both in the footer + settings.

> Note: `@next/third-parties/google` `GoogleAnalytics` component already supports react.dev consent — we use `dataConsent="granted"` per our own banner. If we want LGPD-safe defaults in Brazil, consider *deny-by-default* until accepted.

---

## Phase 5 — Google Analytics 4 rollout

### 5.1 Setup (one time, operator)

- [ ] Create the GA4 property on https://analytics.google.com (measuring successful: choose web platform → id `G-XXXXXXX`).
- [ ] **(OPS)** Create `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXX` in Vercel (Production, Preview, Development) and `.env.local` for local.

### 5.2 Install (code)

Recommended: `@next/third-parties/google` (official Next.js integration, includes Load Started fixes, uses the same `gtag.js`):

```bash
npm i @next/third-parties/google
```

- [ ] **Root layout** (`src/app/layout.tsx`): add the consent-aware tag

```tsx
import { GoogleAnalytics } from "@next/third-parties/google";

// after <html/body> content, only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set
{process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}
                   dataConsent={consentGranted ? "granted" : "denied"} />
)}
```

- [ ] **Consent banner** (`/privacidade` link + a small banner component): store the choice in `localStorage` (e.g. `energyos:consent`), pass it to the tag, and re-mount the tag when consent changes (`gtag('consent','update',{...})`).
- [ ] **Page views** come automatically from `gtag.js`. No extra code needed for route changes.
- [ ] **Events** (tag specific confirmations so we can measure the funnel):

```ts
// src/lib/analytics.ts
export const trackEvent = (name: string, params: Record<string, unknown> = {}) => {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
  window.gtag?.("event", name, params);
};

// calls to add:
trackEvent("sign_up", { method: "email" | "google" });   // cadastro
trackEvent("login", { method });
trackEvent("checkin_completed");
trackEvent("focus_session_completed", { minutes });
trackEvent("first_purchase"); // Loja
trackEvent("group_created");
```

- [ ] **Business events mapping** (define once): Acquisition = sign_up/login; Activation = first check_in or first focus session; Retention = 7-day streak; Revenue = Loja. Create GA4 custom conversions for `checkin_completed` + `first_purchase`.

### 5.3 Verify

- [ ] Google Tag Assistant (chrome) confirms the tag fires.
- [ ] GA4 **Realtime** shows `/`, cadastro, and your test events.
- [ ] Confirm tags do **not** fire when consent is denied.
- [ ] Exclude your own traffic (GA4 → Admin → Data settings → internal traffic) so numbers stay clean.

---

## Phase 6 — Marketing go-live checklist

- [ ] **Product funnel ready** (registration → first check-in takes < 2 min).
- [ ] **Social share assets**: OG image (1200×630) with the energyOS logo + tagline "Seu ritmo, com clareza".
- [ ] **Syllable copy**: landing page in PT-BR, clear "what it does in 5 seconds".
- [ ] Content (breadcrumb for SEO): 1-2 blog/lp posts ("como manter consistência de foco", etc.).
- [ ] **Referral-friendly**: invite friends → both get XP (already partly in the product via Amigos/Grupos). Surface this in onboarding.
- [ ] **Deploy checklist on Vercel**: production env vars set (see `.env` values), `npm run build` clean, admin seeded (`npm run db:seed-admin`), GA tag live, privacy/terms pages linked.
- [ ] **Post-launch watch**: GA4 events after 48h, error monitoring (Vercel logs), check abuse/rate-limit hits.

---

## Definition of Done (sign-off)

- [ ] Phase 0–3 complete: no known critical/security blockers, key bugs fixed or consciously deferred, Lighthouse passes, mobile nav works.
- [ ] Phase 4 complete: Privacy Policy + Terms + consent banner live.
- [ ] Phase 5 complete: GA4 fires with consent, Realtime shows traffic.
- [ ] Phase 6 complete: landing, OG assets, deploy clean.
- [ ] One human reviewer signs off on: legality (LGPD), the marketing copy, and the analytics funnel definition.

---

## Quick references

| Task | Command / file |
|---|---|
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Apply schema | `npm run db:init` |
| Seed admin | `npm run db:seed-admin` |
| Recompute XP (after dedupe) | `npm run db:recompute-xp` |
| Env (local) | `.env.example` → `.env.local` |
| Env (prod) | `vercel env add <NAME> production` / dashboard |
| Security audit | `SECURITY_AUDIT.md` |
| Bug matrix | `STATUS.md` |