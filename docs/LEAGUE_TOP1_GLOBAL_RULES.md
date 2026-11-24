# League — Top 1 Global rule (current behavior + alternatives)

**Investigated:** `src/lib/league-reset.ts`, `src/lib/db/league-new.ts`,
`src/lib/league-new-meta.ts`, `scripts/cleanup-top1-global.sql`.

## Current behavior (implemented, do not change automatically)

A profile earns the "Top 1 Global" bonus (`TOP1_GLOBAL_FIRST_UNLOCK_BONUS = 1_000`
coins, `reward_kind = 'top1_global_unlock'`) when — **all** of these hold:

1. **Tier:** the group is `LEGENDS` (`league_weekly_results.tier = 'LEGENDS'`).
2. **XP:** `weekly_xp > 0` ("real activity").
3. **Group size:** `league_weekly_results` group has more than one member
   (the leader can't qualify alone).
4. **Rank:** the member is rank 1 **or** tied for the group top score
   (`tiedForTop`, computed as `member.weekly_xp === topWeeklyXP` in
   `league-new.ts:241,392`).

Counters live in `profiles.times_top_1_global` + `profiles.last_top_1_global_week`
and the achievement progress in `user_achievement_progress(achievement_id='top_1_global')`.

Code refs:
- `src/lib/league-reset.ts:61-88` — rule + award flow.
- `src/lib/db/league-new.ts:319-340` — `recordTop1GlobalFinish` (per-week idempotency via
  `last_top_1_global_week is distinct from $2::date`).
- `src/lib/league-reset.test.ts` — unit tests of the rule.

Note: **podium coins** (1st/2nd/3rd, `league-podium:`) are a separate concept and are
unaffected by the Top 1 Global rule.

## Alternatives (product decision — NOT changed)

| Rule variant | Definition | Behavior change |
|---|---|---|
| Current | LEGENDS + XP>0 + group>1 + rank 1/tie | baseline |
| **Alt A: "#1 of any tier"** | tier ≠ anything (any group) + group>1 + rank 1/tie + XP>0 | the badge/bonus applies to the top player of every tier (e.g., SILVER/GOLD groups with active members) |
| **Alt B: allow 0-XP leaders** | remove the `weekly_xp > 0` condition | groups led by a player with no XP this week qualify |
| **Alt C: solo leaders** | drop `group_size > 1` | solo groups also qualify (devalues the rule) |
| **Alt D: all tied at top** | `tiedForTop` already exists — extend to ties for 2nd place | borderline — currently only top score ties get the badge |

Notes on consistency: any change to the rule above must be applied to BOTH:
1. `persistLeagueWeeklyResultOnce` in `src/lib/league-reset.ts` (code path), and
2. `scripts/cleanup-top1-global.sql` (recalculation path, `top1_legit` CTE).

## Recommendation

Keep the current rule. If the product wants "Top 1 Global" to mean "#1 of any
tier", switch to **Alt A** and add unit tests mirroring
`src/lib/league-reset.test.ts` (see the InMemoryLeagueResultWriter pattern)
plus an update to `cleanup-top1-global.sql` (`tier = 'LEGENDS'` condition).

Flagged as a product decision requiring approval — no change made here.
