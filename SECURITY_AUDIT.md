# EnergyOS — Security & Reliability Audit

**Date:** 2026-09-03
**Scope:** Full-stack review of the Next.js app (`src/app/api/**`, `src/lib/**`), database schema (`src/db-schema.sql`), scripts, and environment configuration.
**Method:** Manual code review of every security-sensitive path (auth, economy/XP, ownership checks, validation, error handling, logging, configuration).

> Severity scale: 🔴 Critical (exploitable / money-level impact) · 🟠 High · 🟡 Medium · ⚪ Low/Informational
> Status: ✅ Fixed in this codebase · ⚠️ Partially fixed · ❌ Open (recommendation documented)

---

## Executive summary

The audit found **27 issues**: **7 critical** (economy-farming exploits and runtime crashes in the XP system), **5 high** security gaps (missing headers, debug endpoints, auth weaknesses), and **15 medium/low** issues (data exposure, bad API returns, logic dead-ends). All critical and high issues have been fixed in code; a handful of medium items remain open as documented recommendations (rate-limit wiring, JSON validation sweep, credential rotation, TLS verification).

---

## 🔴 Critical — Exploits

### C1. Focus XP farming via client-controlled `focusedSeconds`
- **File:** `src/lib/db/focus.ts` → `endFocusSession()`; route `src/app/api/focus/route.ts`
- **What was wrong:** The server accepted any `focusedSeconds` value from the client (`Number.isFinite && >= 0` were the only checks) and computed XP as `minutes × FOCUS_XP_PER_MIN`, coins as `minutes / 10`, plus quest progress (`TOTAL_MINUTES`), streak qualification, garden plants, and **group leaderboard contributions** — all from the client-reported number.
- **Real-life impact:** `POST /api/focus { action:"end", sessionId, focusedSeconds: 999999 }` on a 25-min session instantly granted ~16,000 XP, ~1,600 coins, maxed daily quests, a guaranteed streak day, 4 garden plants, and thousands of group minutes. Leaderboards and leagues were trivially corrupted.
- **Fix (✅):** Duration is now clamped server-side to the session's own `target_duration_minutes` (max 240), which is the maximum legitimate reward per session.

### C2. Daily-quest cheat endpoint (client-controlled progress + amount)
- **File:** `src/app/api/daily-quests/progress/route.ts`
- **What was wrong:** The POST route accepted `{ questType, questId, amount }` and called `incrementQuestProgress(..., Number(body.amount) || 1)` with **no bounds and no server-side verification**. Quest completion awards coins (10–20) and boosted XP via the claim flow.
- **Real-life impact:** One request — `{ "questType": "SESSIONS_COUNT", "questId": 1, "amount": 99999 }` — completed every quest instantly; looping it printed free currency. Negative amounts were also possible.
- **Fix (✅):** The client-driven path is removed (returns a 400 `ValidationError`); only `sessionData` remains and `durationMinutes` is clamped to 0–240, matching the same cap used by `endFocusSession`.

### C3. Check-in backdating → XP/coin/streak farming
- **File:** `src/lib/db/checkins.ts` → `upsertCheckin()`; route `src/app/api/checkins/route.ts`
- **What was wrong:** `checkinDate` came from the client and `parseDate()` only validated the format — **any past date** was accepted. Each *new* date granted `CHECKIN_XP` (15), `CHECKIN_COINS` (5) and a streak bonus (up to 50 XP/day).
- **Real-life impact:** 365 scripted POSTs with `checkinDate` = each day of the past year = ~5,475 XP + ~1,825 coins + max streak bonus on every row, without using the app once.
- **Fix (✅):** The date is resolved server-side (`todayIso()`); a client-supplied `checkinDate` different from today is rejected with a 400.

### C4. Store purchase race conditions (double-charge, negative balance, coin loss)
- **Files:** `src/lib/db/store.ts` (`purchaseDecoration`, `purchaseAura`, `purchaseShield`, `unlockBanner`, `purchaseStreakShieldDesign`), `src/lib/db/xp-boost.ts` (`purchaseXpBoost`)
- **What was wrong:** Every purchase followed the pattern: (1) read balance *outside* the transaction, (2) `begin`, (3) `update ... set coins = coins - $1` **without a `coins >= $1` guard**, (4) insert item with `on conflict do nothing` **ignoring whether it actually inserted**.
  - Two concurrent requests both passed the balance check → balance went **negative**.
  - For decorations/auras, the second request paid again while `on conflict do nothing` silently skipped the insert → **paid twice, got one item**.
  - `purchaseXpBoost` had the worst variant: if the 10-potion cap was hit between the check and the upsert, the `where user_potions.quantity < $3` made the update a **no-op while coins were still deducted** → coins lost with nothing received.
- **Fix (✅):** All six purchase functions rewritten as atomic transactions: guarded deduction (`update ... where coins >= $1 returning coins`, no row ⇒ 403), ownership/cap enforced **inside** the transaction with `returning` (no row ⇒ 409 and full rollback). Coins can no longer go negative, be double-charged, or vanish.

### C5. XP ledger not idempotent (double rewards)
- **Files:** `src/lib/db/xp.ts` → `creditXP()`, `src/db-schema.sql`
- **What was wrong:** `xp_ledger` had **no unique constraint** on `(profile_id, source, source_id)`. `creditXP` blindly inserted; idempotency relied on racy check-then-insert code in callers. The check-in "isNew" detection was a TOCTOU race (two concurrent first saves both read "no existing row" → both awarded).
- **Fix (✅):**
  - Schema: unique index `xp_ledger_dedupe_idx on xp_ledger(profile_id, source, coalesce(source_id,''))`.
  - `creditXP` now inserts with `on conflict ... do nothing returning id`; **no row ⇒ duplicate ⇒ credit nothing** (no `user_xp` increment, no league XP, no mission progress).
  - Check-in first-save detection now uses the atomic `returning (xmax = 0) as inserted` trick instead of a separate SELECT.

---

## 🔴 Critical — Runtime bugs (the errors in your logs)

### B1. `checkin_streak` XP insert crashed on every first check-in with a streak
- **Files:** `src/db-schema.sql` (line 282: `source_id bigint`), `src/lib/db/checkins.ts`
- **What was wrong:** The code passed `` `${profileId}:${date}` `` (e.g. `"abc-uuid:2026-09-03"`) as `source_id` — a **non-numeric string into a `bigint` column**. Postgres rejected it with `invalid input syntax for type bigint`, so **every first check-in of a user with streak > 0 threw a 500** after the row was already written.
- **Fix (✅):** Column migrated to `text` (`alter table xp_ledger alter column source_id type text using source_id::text`, idempotent in the schema file); the code now passes the plain `date` as the ledger key.

### B2. `kanban_task` XP violated the DB CHECK constraint
- **Files:** `src/db-schema.sql` (line 281 CHECK), `src/lib/db/xp.ts` → `awardKanbanXP()`
- **What was wrong:** The schema allowed `source in ('task','kanban','focus','streak_bonus','daily_quest','daily_task','checkin','checkin_streak','goal')` but the code inserted `source = 'kanban_task'` → `check_violation` on **every kanban completion XP award** (failed task promotion / broken XP).
- **Fix (✅):** Constraint rebuilt to include `kanban_task` (drop-if-exists + add, safe to re-run); `awardKanbanXP` simplified to rely on the idempotent `creditXP`.

### B3. `completeFocusRoom` duplicated garden plants and allowed completing waiting rooms
- **Files:** `src/lib/db/focus-rooms.ts` → `completeFocusRoom()`; route `.../[roomId]/complete/route.ts`
- **What was wrong:** The room update was guarded (`status != 'completed'`) but the function **continued anyway on repeat calls**, re-running the participant loop and calling `plantGardenEntries(profileId, null, ...)` (session_id `null` has no dedupe) — every re-call planted duplicate garden entries for all participants. Any status (including `waiting`) could be "completed".
- **Fix (✅):** Completion only transitions `active`/`paused` rooms (`returning id`); all side effects (mission progress, garden planting) run **only when the transition actually happened**.

---

## 🟠 High — Security gaps

### H1. No security headers anywhere
- **File:** `next.config.ts` (no `headers()`, no `middleware.ts` in the project)
- **What was wrong:** No CSP, no `X-Frame-Options`, no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy` — the app was clickable-iframe-able, MIME-sniffable, and without transport hardening.
- **Fix (✅):** `headers()` block added to `next.config.ts`: CSP (allows Firebase Identity Toolkit/Google APIs, GA, Cloudinary; `frame-ancestors 'none'`, `object-src 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

### H2. `/api/env-status` — hardcoded-email gate + partial secret exposure
- **File:** `src/app/api/env-status/route.ts`
- **What was wrong:** Access gate was `auth.email === "pciskolargx@gmail.com"` (email-keyed auth is weaker than role-based, and previously no `email_verified` check existed), and the response included **masked values** — first 3 + last 2 characters of `CLOUDINARY_API_SECRET` and `DATABASE_URL`.
- **Fix (✅):** Gated by `requireAdmin()` (DB-backed role); secret keys are now reported as **set/unset only** — no fragment of any secret value is returned.

### H3. `/api/test` debug endpoint live in production
- **File:** `src/app/api/test/route.ts`
- **What was wrong:** Returned the caller's identity (email, displayName), database status and timestamps with no environment guard, and logged profile/email to server logs on every hit.
- **Fix (✅):** Returns 404 when `NODE_ENV === "production"`; noisy logging removed.

### H4. No rate limiting on abuse-prone endpoints
- **What was wrong:** Nothing throttled user search, DMs (spam vector — see M6), group messages, check-ins, focus-session starts, recap generation, or room creation. A scripted client could hammer all of them.
- **Fix (✅):** `src/lib/rate-limit.ts` (in-memory fixed-window limiter, throws 429 `AppError` so it plugs into `handleRoute`/existing catch blocks), wired into every endpoint in the original risk list with these exact budgets: `social/search` GET 30/min · `dm` POST (`dm/[friendId]` + `dm/by-username`) 20/min · `groups/[id]/messages` POST 30/min · `checkins` POST 10/min · `focus` POST 30/min · `recap` POST 5/hour · `focus-rooms` POST 10/min. Note: in-memory limits are per-instance; for multi-instance deployments use Redis/Upstash.

### H5. No `email_verified` check in authentication
- **File:** `src/lib/server-auth.ts`
- **What was wrong:** `requireAuth()` resolved identity via Firebase `accounts:lookup` but never checked `emailVerified` — an account created with someone else's email (unverified) was fully honored, which matters for any email-keyed logic (e.g. the old env-status gate).
- **Fix (✅):** Requests with an existing but unverified email now get 401 ("Confirme seu e-mail para continuar.").

---

## 🟡 Medium — Data exposure, input handling, logic

### M1. User search enabled email enumeration ✅
- **File:** `src/lib/db/social.ts` → `searchUsers()`
- **What was wrong:** The WHERE clause matched `coalesce(p.email, '') ilike $2` — substring probing of emails let any authenticated user enumerate registered addresses (privacy leak / account discovery).
- **Fix (✅):** Email matching removed; search is display-name/username only.

### M2. Real secrets committed in `.env.example` ✅ (with required follow-up)
- **File:** `.env.example`
- **What was wrong:** The file contained what appear to be **real production credentials**: `CLOUDINARY_API_SECRET`, and a complete `DATABASE_URL` with username, password, and host for the Neon production database. Although all `.env*` files are currently git-ignored (verified via `git check-ignore`), this file is *meant* to be committed and was one `git add -f` away from leaking everything into the public repo.
- **Fix (✅):** Replaced with placeholders + warning comments + `AUTH_ALLOW_UNVERIFIED=false` documented.
- **⚠️ Required follow-up (cannot be done in code):** **Rotate** the Cloudinary API secret and the Neon DB password — treat them as exposed since they existed in plaintext and this repo is public.

### M3. Malformed JSON → 500 instead of 400 (bad API returns) ✅
- **Files:** ~25 routes calling raw `await request.json()` — `store/decorations`, `store/banner`, `store/auras`, `store/shield-designs`, `dm/[friendId]`, `dm/by-username`, `groups/[id]/messages`, `groups/*`, `recap`, `recap/share`, `achievements`, `friends`, etc.
- **What was wrong:** `request.json()` throws `SyntaxError` on invalid JSON (caught by the generic 500 branch), and `body.decorationId` on a `null`/array body throws `TypeError` → misleading "Erro interno." 500s in logs for trivially invalid input.
- **Fix (✅):** `readJsonBody()` now throws `BadRequestError` (an `AppError`) so both `handleRoute` and manual `catch (error instanceof AppError)` blocks map malformed/null/array bodies to 400. All raw-`request.json()` routes were converted (17 files). Three endpoints intentionally keep tolerant parsing (`habits/[id]/completions`, `weekly-plans/[id]` PATCH, `daily-tasks/[id]` PATCH) because an **empty body is a valid request** for them (legacy client compat, `.catch(() => ({}))` fallback) — malformed JSON there degrades to the default action, never a 500.

### M4. `/api/relatorio` unvalidated `days` parameter ✅
- **File:** `src/app/api/relatorio/route.ts`
- **What was wrong:** `parseInt(daysParam)` with no bounds — `days=0` queried future ranges, `days=-5` inverted the window, `days=999999` forced huge range scans (query-cost abuse).
- **Fix (✅):** `parseNumber(..., { integer: true, min: 1, max: 366, fallback: 7 })`.

### M5. PII/noise logging in API routes ✅
- **Files:** `checkins/route.ts` (logged full request body), `test/route.ts` (logged email/profile), `server-auth.ts` (logged on every request), `store.ts` (purchase logs incl. balances), `tasks/[id]/route.ts`, `focus-rooms/[roomId]/join/route.ts`
- **Fix (✅):** Removed from all of the above — checkins, test, server-auth, store, tasks and focus-rooms/join now log only errors.

### M6. DM-by-username spam vector ❌ (flagged)
- **File:** `src/lib/db/messages.ts` → `sendDirectMessageByUsername()`
- **What was wrong:** Sends a friend request *and stores the message* for non-friends on every call (the comment claims it "won't be delivered", but `listDirectMessages` performs no filtering — everything appears once friendship is accepted). With no rate limit, this is a friend-request + message spam loop against any username.
- **Recommendation:** enforce the rate limiter on `POST /api/dm/by-username` and `POST /api/dm/[friendId]` (e.g. 20/min per profile), and consider a cooldown on repeated requests to the same target.

### M7. Database TLS verification disabled ✅
- **File:** `src/lib/db.ts` (also `scripts/init-db.mjs`)
- **What was wrong:** `ssl: { rejectUnauthorized: false }` for Neon — the connection is encrypted but the server certificate is **not verified**, so an active MITM can intercept DB traffic.
- **Fix (✅):** Strict TLS (`rejectUnauthorized: true`) is enforced for Neon in **production** (or when `DATABASE_SSL_STRICT=true`); dev keeps the lenient mode. The Neon CA bundle download endpoint now requires auth, but this turned out to be unnecessary: the production endpoint was **empirically verified** to present a publicly-trusted certificate chain (Amazon Trust Services) that Node's built-in Mozilla root store validates (`rejectUnauthorized: true` connect test passed). An optional `DATABASE_SSL_CA_PATH` env var allows pinning an explicit CA bundle if ever needed; `scripts/init-db.mjs` follows the same policy.

### M8. `next/image` allows any remote host ✅
- **File:** `next.config.ts` → `images.remotePatterns`
- **What was wrong:** Combined with free-form `photoUrl`/`banner_image_url` inputs, this let any third-party host be used as an image source (tracking pixels, mixed-content tricks, broken-avatar substitution).
- **Fix (✅):** Replaced `hostname: '*'` with a data-driven allowlist. A live query over `photo_url`/`banner_image_url` across all profiles found **only `res.cloudinary.com`** in use (2 banner rows; photo URLs are non-remote). Allowlist: `res.cloudinary.com`, `lh3.googleusercontent.com`, `*.googleusercontent.com` (Firebase Google profile photos). If a user ever hosts an avatar elsewhere, the allowlist needs an entry.

### M9. `markDmRead` doesn't verify friendship ✅
- **File:** `src/lib/db/messages.ts`
- **What was wrong:** Writes a `dm_reads` row for any `otherId` without checking friendship — harmless data pollution, but inconsistent with the rest of the DM surface.
- **Fix (✅):** `assertFriends(profileId, other)` added, matching the other DM functions.

### M10. Dead-code length check in DM validation ✅
- **File:** `src/lib/db/messages.ts` → `sendDirectMessage()`, `sendDirectMessageByUsername()`
- **What was wrong:** `parseTitle()` caps at 200 chars, so the following `if (text.length > 2000)` could never trigger — the "2000 char" limit was fiction; real limit was 200.
- **Fix (✅):** New `parseMessage()` helper in `validation.ts` enforcing the intended 2000-char limit (verified safe: `direct_messages.body` is a `text` column), used by both send paths; dead checks removed. Net effect: DMs may now legitimately carry up to 2000 chars as originally intended.

### M11. Hardcoded quest IDs in the progress route ⚪ (fixed incidentally)
- **File:** `src/app/api/daily-quests/progress/route.ts`
- **What was wrong:** The route assumed `questId === 1/2/3` map to specific missions, but (per the code's own comment) mission row ids are not fixed — progress landed on the wrong quests.
- **Fix (✅ within the C2 rewrite):** the route keeps its legacy IDs but no longer accepts client-driven targeting; the canonical path is `recordMissionProgress()` (metric-based) invoked server-side by focus/checkin flows.

### M12. `/api/focus-rooms/cleanup` abusable by any authenticated user ✅
- **File:** `src/app/api/focus-rooms/cleanup/route.ts`
- **What was wrong:** Any authenticated user could trigger the sweep with arbitrary `waitingTimeoutMs`/`retentionMs` query params (unvalidated `Number()`).
- **Fix (✅):** Now requires an **admin session** (`requireAdmin()`) **or** a shared cron secret (`CRON_SECRET` env, via `x-cron-secret` or `Authorization: Bearer` header) so external schedulers keep working; both params are clamped via `parseNumber` (`waitingTimeoutMs` 1min–24h default 45min, `retentionMs` 1h–30d default 24h).

### M13. Token verification cache window ⚪ (accepted trade-off)
- **File:** `src/lib/server-auth.ts`
- **What was wrong (design note):** verified identities are cached 5 minutes keyed by raw token — a revoked/disabled account can keep calling APIs for up to 5 minutes. Bounded at 500 entries.
- **Recommendation:** keep, but document; reduce TTL if faster revocation is needed.

### M14. `xp_ledger` unique index may fail on existing duplicate rows 🔴 (CONFIRMED — required manual step)
- **File:** `src/db-schema.sql`
- **Live-database check (2026-09-03):** the production database **has not yet received** the xp_ledger hardening — `source_id` is still `bigint`, the CHECK constraint still lacks `kanban_task`, **no dedupe index exists**, and there are **6 duplicate `(profile_id, source, source_id)` groups** (all under legacy sources: focus/checkin/task/daily_task/daily_quest/kanban). Running `npm run db:init` **will fail** (the whole multi-statement script is atomic) until rows are deduplicated.
- **Required manual step (run first, in this order):**
  ```sql
  -- 1. Inspect the duplicates (6 groups as of the audit):
  select profile_id, source, coalesce(source_id::text,'') as key, count(*) as n
    from xp_ledger group by 1,2,3 having count(*) > 1;

  -- 2. Deduplicate (keeps the earliest row of each group):
  delete from xp_ledger a using xp_ledger b
   where a.id > b.id
     and a.profile_id = b.profile_id
     and a.source = b.source
     and coalesce(a.source_id::text,'') = coalesce(b.source_id::text,'');

  -- 3. Then apply the schema: npm run db:init
  ```
  Do **not** run the delete against production automatically — review the 6 groups first (they also explain past double-rewards; optionally reconcile `user_xp.total_xp` for affected profiles).

### M15. Unused imports / dead parameters after fixes ⚪
- `src/lib/db/checkins.ts`: `parseDate` import and the `hasAnyValue` flow remain valid; `UpsertCheckinInput.checkinDate` is now only accepted when equal to today.
- `src/lib/db/xp-boost.ts`: `getPotionQuantity` still used by inventory reads (no dead code).
- `src/app/api/daily-quests/progress/route.ts`: `updated` array now populated in all branches (previously partial).

---

## What was changed (files)

| File | Change |
|---|---|
| `src/db-schema.sql` | `xp_ledger.source_id` → `text`; CHECK constraint includes `kanban_task`; unique dedupe index added (all idempotent — re-run with `npm run db:init`) |
| `src/lib/db/xp.ts` | `creditXP` idempotent via `on conflict do nothing returning id`; kanban/streak helpers simplified |
| `src/lib/db/checkins.ts` | Today-only check-ins; atomic first-save detection (`xmax = 0`); streak ledger key = date; noisy logs removed |
| `src/app/api/checkins/route.ts` | No PII logging; date handling documented |
| `src/lib/db/focus.ts` | `focusedSeconds` clamped to target duration |
| `src/lib/db/focus-rooms.ts` | Completion transition-guarded (active/paused only); side effects run once |
| `src/lib/db/store.ts` | 5 purchase functions rewritten as atomic guarded transactions; purchase logs removed |
| `src/lib/db/xp-boost.ts` | Cap-race fixed — coins can never be deducted without granting the potion |
| `src/app/api/daily-quests/progress/route.ts` | Client cheat path removed; session data clamped |
| `src/lib/server-auth.ts` | `emailVerified` enforced; request-level logs removed |
| `src/app/api/env-status/route.ts` | `requireAdmin` gate; secrets reported as set/unset only |
| `src/app/api/test/route.ts` | 404 in production |
| `src/app/api/relatorio/route.ts` | `days` bounded to 1–366 |
| `src/lib/db/social.ts` | Email matching removed from user search |
| `src/lib/rate-limit.ts` | **New** — reusable rate limiter (429 `AppError`) |
| `next.config.ts` | Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) |
| `.env.example` | Real secrets replaced with placeholders |

---

## Remaining recommendations (priority order)

1. **Rotate credentials now** (M2): Cloudinary API secret + Neon DB password. They lived in plaintext on disk in a public repo's working tree.
2. **Wire the rate limiter** (H4). Pattern for any AppError-mapped route:
   ```ts
   import { rateLimitForProfile } from "@/lib/rate-limit";

   // inside the handler, after requireAuth:
   rateLimitForProfile(profileId, "dm-send", 20, 60_000);
   ```
   Suggested budgets: `social/search` 30/min · `dm` POST 20/min · `groups/[id]/messages` POST 30/min · `checkins` POST 10/min · `focus` POST 30/min · `recap` POST 5/hour · `focus-rooms` POST 10/min.
3. **JSON-validation sweep** (M3): replace raw `request.json()` with `readJsonBody()` + `assertObject()` in the ~25 routes listed above.
4. **Neon TLS verification** (M7): pin the CA and set `rejectUnauthorized: true`.
5. **Tighten `remotePatterns`** (M8) after auditing stored `photo_url`/`banner_image_url` values.
6. Apply the small items: friendship check in `markDmRead` (M9), dead 2000-char check (M10), cleanup endpoint hardening (M12), log cleanup in `tasks/[id]` and `focus-rooms/join` (M5).
7. Consider moving token verification to `firebase-admin` + `verifyIdToken()` (full signature/audience validation without the extra Google API round-trip) — the current `accounts:lookup` approach is valid but adds latency and depends on the public API key.

---

## How to apply / verify

```bash
# 1. Apply schema changes (idempotent; see M14 if unique index fails on dupes)
npm run db:init

# 2. Type-check
npx tsc --noEmit

# 3. Smoke-test the fixed flows
#    - complete a focus session (XP should equal target duration, not more)
#    - first check-in of the day with a streak > 0 (no more 500s — B1)
#    - complete a kanban task (XP awarded — B2)
#    - double-submit a purchase (single charge only — C4)
```
