# Onboarding — investigation of the 19 `onboarding_completed=false` profiles

**Date:** 2025-11-24 (read-only investigation; no changes made).

## 1. Do the profiles still exist?

Yes. Read-only query over the production database
(via `src/lib/db.ts` pool):

```sql
select count(*)::int as n
from user_settings where onboarding_completed = false;
```

Result: **19** (matches the checklist). Sample rows (profile_id, display_name, created_at):
- cd00e45f-6792-4e35-a1f3-dd546572acba — "JJ" — 2026-08-25T17:29:16Z
- 590baef3-1508-4730-827e-305bb8367a48 — "Sintonia Masculina" — 2026-08-25T18:48:02Z
- 61429bab-d36a-41c5-a4f1-e128ca5efc38 — "Fabão" — 2026-08-25T19:34:05Z
- 6cec04d1-f782-487c-9553-73ca95f54658 — "GABRIEL FELIPE SABINO DE SOUZA" — 2026-08-27T10:26:36Z
- test-store-bug-1788089829097 — "Test Store Bug" — 2026-08-30T11:37:09Z
- …plus 14 more (full list available with the same query).

The profiles exist because every row in `user_settings` has a joined `profiles` row
(verified by the same query).

## 2. How onboarding is triggered

- `src/components/app-extras.tsx:180` mounts `<OnboardingTour />`.
- `src/components/onboarding-tour.tsx:157` — `setOpen(!s.onboardingCompleted)` when
  settings load: the tour opens when `onboardingCompleted` is false/null.
- `src/components/onboarding-tour.tsx:165` — after the tour completes:
  `await api.saveSettings({ onboardingCompleted: true })`.
- `src/app/configuracoes/page.tsx:121-127` — "Reiniciar tour" sets
  `onboardingCompleted: false` again.
- Settings defaults: `ensureUserBootstrap` inserts `user_settings` with
  `onboarding_completed = false` (`src/lib/db/bootstrap.ts:80-81`).

## 3. Expected behavior (design notes)

- The 19 profiles created **before** the default flipped (or before the
  migration) still have `onboarding_completed = false` — this is the expected
  end-state of a boolean flip, not a bug per se.
- The tour is designed to be idempotent: it opens, and on completion saves
  `true`. Opening it again only happens if a user explicitly sets
  `onboardingCompleted: false` (settings page) or the user re-logs in fresh.

## 4. Duplicate initial rewards?

- `coin_transactions` by reward_kind (read-only): **0 rows** — there are no
  coin-grant transactions of any kind in the current production DB.
- `user_settings` with `coins > 0`: **20** (general grants, unrelated to
  onboarding; no `top1_global_unlock` rows exist — see
  `docs/CLEANUP_TOP1_GLOBAL_REPORT.md`).
- No rows with `reason like '%onboard%'` — there is no separate "onboarding
  coins" grant path in the code today (`bootstrap.ts` inserts `coins = 0`).

So **no duplication mechanism was found** in the current implementation.

## 5. Recommendation (not auto-applied)

1. **Do not auto-mark** — that would hide the tour for accounts the user
   created after this flip (the 19 are legacy accounts; new users already get
   `onboarding_completed = false` → see tour, which is the intended flow).
2. If the product decides these 19 *should* have completed onboarding:
   - Manual one-off UPDATE (owner-run):
     `update user_settings set onboarding_completed = true where onboarding_completed = false;`
   - Or surface a per-user setting in the UI ("repetir tour").
3. Decide individually whether to treat any of the 19 as "new" (fresh
   onboarding) vs. "already finished" — that needs the human's judgment on the
   display names above.

## 6. Verification queries (read-only)

```sql
select count(*)::int as onboarding_false from user_settings where onboarding_completed = false;
select p.display_name, s.created_at from user_settings s join profiles p on p.id = s.profile_id
 where s.onboarding_completed = false order by s.created_at;
select count(*)::int as tx_rows from coin_transactions;
select reward_kind, count(*)::int as n, sum(amount) as total
 from coin_transactions group by reward_kind;
```

Status: **investigated; no changes made.**
