# Top 1 Global — cleanup report

**Script:** `scripts/cleanup-top1-global.sql`
**Status:** **NOT EXECUTED.** Investigation done 2025-11-24 (read-only). Requires human approval.

## What the script does

Step 1 — builds `top1_legit` from `league_weekly_results` using the same rule as the fixed code:

```sql
tier = 'LEGENDS' AND weekly_xp > 0 AND group_size > 1 AND weekly_xp = group_top_score
```

(`grp` = group size + max weekly_xp per `league_group_id` + `week_start_date`.)

Step 2 — preview SELECT over `profiles`: compares stored `times_top_1_global` / `last_top_1_global_week` against the recomputed values.

Step 3 — applies:

1. `update profiles set times_top_1_global = <legit_count>, last_top_1_global_week = <last_legit_week>` for profiles with a legit count.
2. `update profiles set times_top_1_global = 0, last_top_1_global_week = null where times_top_1_global > 0 and not exists (legit row)` — resets counters of profiles with **zero** legit finishes.
3. `update user_achievement_progress set current_value = <legit_count> where achievement_id = 'top_1_global' and current_value <> <legit_count>`.
4. `delete from user_achievement_progress where achievement_id = 'top_1_global' and not exists (legit row)` — deletes progress rows that were **never earned** (no qualifying LEGENDS finish).

All inside `begin; ... commit;`.

## Schema consistency (verified read-only)

Fields used by the script exist in `src/db-schema.sql`:

- `profiles.times_top_1_global integer not null default 0` (lines 6, 9)
- `profiles.last_top_1_global_week date` (lines 7, 10)
- `user_achievement_progress.achievement_id` / `current_value` (used by `delete`, idempotent per profile)
- `league_weekly_results(league_group_id, week_start_date, tier, weekly_xp, rank, group size via count(*))`

## Preview to review before running

Step 2 of the script prints every profile where stored vs. legit counts differ. Run the `SELECT` statements it contains first; only then run the full script.

## Data safety

- **Idempotent:** `delete`/`update` only fire when stored ≠ computed, and the whole script runs in a transaction.
- **Does not touch `coin_transactions`** (by design — see below).
- **No user balances are changed** by this script.

## Rollback

Counter state is fully derived from `league_weekly_results` (the source of truth), so:

1. Restore the database from a `pg_dump` taken immediately before execution, or
2. Re-run the same script against the DB — it is idempotent, and `delete` only removes never-earned progress rows.

## Required backup procedure (from the script header)

```bash
pg_dump "$DATABASE_URL" -t profiles -t user_achievement_progress \
  -t coin_transactions > backup-top1-$(date +%F).sql
```

Note: `coin_transactions` is included here even though this script does not modify it, because the coin-reversal script (`scripts/reverse-top1-global-bonuses.sql`) may interact with it — see the audit item C report.

## Caveat found during investigation

- Production read-only query result: `coin_transactions` with `reward_kind = 'top1_global_unlock'` → **0 rows** (verified via `src/lib/db/league-new.ts` path and direct SELECT). So the reversal script would be a no-op on the current database — but history may exist in other environments/backups; it is still prepared for review.
- `league-new.ts` inserts the unlock bonus with `reference_key = 'top1-global-bonus:<profileId>'` and `on conflict (reference_key) do nothing` — the insert is idempotent.

## How to execute (when approved)

```bash
psql "$DATABASE_URL" -f scripts/cleanup-top1-global.sql
```
