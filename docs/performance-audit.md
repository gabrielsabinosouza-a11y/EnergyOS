# EnergyOS performance audit

> Updated audit: source-level findings below are distinguished from measured
> production impact. The incident's exact cause is still unproven because the
> available production query-statistics window did not contain representative
> application traffic.

## Conclusion

Two source-level issues are relevant: a Kanban completion reward path could
starve the shared PostgreSQL pool, and streak reconciliation was too expensive
for repeated reads. The pool hazard was fixed in the current `HEAD`; this audit
also fixed a calendar freshness check that could repeatedly invoke reconciliation
for inactive users. Neither code finding can be asserted as the incident's exact
cause without representative request/query traces. No end-to-end latency target
has been measured after these changes.

## Findings

- The nested pool acquisition was introduced in `fc19c61` when Kanban rewards
  began updating league XP. The API routes that reach it are Kanban task
  completion and move-to-done.
- All 53 explicit `pool.connect()` sites reviewed release clients in `finally`;
  there was no general client leak. The Kanban reward path was instead a
  re-entrant pool-use hazard.
- `moveKanbanTask` performs several reorder statements using one client, but
  does not issue `BEGIN`/`COMMIT`. Its comment claiming a transaction is
  inaccurate; concurrent moves can interleave. This is a correctness risk, not
  evidence of the reported broad latency, and was not changed in this audit.
- Dashboard loading awaits `Promise.allSettled` for its initial requests, and
  the shared browser API client has no request timeout. A stalled request can
  therefore leave the dashboard loading indefinitely. This explains a UI
  symptom but does not identify the upstream cause.
- `src/lib/http.ts` already logs requests slower than one second, but most
  handlers do not pass route context. Dashboard and Kanban list/mutation
  handlers now pass route and method context so those slow requests are
  identifiable in server logs.
- `src/lib/performance.ts` is not wired into request handlers or database
  queries. Its in-memory summary does not retain completed request durations,
  so it is not an effective metrics dashboard.
- The Kanban creation path also had verbose debug logging of full request and
  task objects. Those logs were removed; they were not evidence of the broad
  slowdown and could expose user content in server logs.

## Streak reconciliation and change history

`computeStreak()` locks the profile, reads a bounded history (up to 400 days),
and can write streak-day rows sequentially in a transaction. It had been called
from dashboard, social-profile, report, and calendar read paths before the
recent Kanban work. Git history places this usage before the Kanban reward
change, so it is an existing expensive path, not evidence that Kanban introduced
it. Commit `eb03573` moved several reads to the persisted `getStreakInfo()`
snapshot, but its calendar freshness predicate could keep reconciling profiles
with no focus session today.

The current calendar route compares the latest focus, shield-use, and streak-log
dates and reconciles only when activity is unlogged or an active streak is
missing a log through yesterday. The dashboard route also no longer performs a
second bootstrap before `buildDashboardSnapshot()`, which already bootstraps
with authenticated profile details.

## Database observations

Query telemetry was unavailable initially. With explicit authorization,
`pg_stat_statements` was installed on the `neondb` database of the EnergyOS
production branch (`purple-dew-79352084` / `br-dawn-waterfall-ax88qcnx`).
Statistics began at installation, so the first `calls`/`outliers` snapshot
contains diagnostics only, not a representative application workload.

At inspection time:

- No query was running longer than 30 seconds or five minutes.
- No blocked lock was observed.
- The database was about 40.9 MB; `kanban_tasks` was 16 KB. These sizes do not
  support a table-scan or data-volume explanation for multi-minute latency.
- The slow-query list contained only setup/diagnostic queries; its highest
  application-independent result was a table-size inspection at about 107 ms.
- Sequential-scan and unused-index counters are not actionable without a
  representative workload and query plans. No index changes were made.
- A non-executing plan of the calendar freshness query shape used the profile
  index for focus-session lookup and the streak-log primary-key index; it used
  a sequential scan for shield-use rows. The table is small in the observed
  dataset, and the plan cost is not a measured runtime. No index change is
  justified from that plan alone.

These are point-in-time observations, not proof that intermittent production
latency never occurs. The local `.env` database host differs from the selected
EnergyOS project, so no local application traffic was pointed at production or
used to manufacture query statistics.

## Validation and remaining work

- The focused streak reconciliation tests passed (10/10).
- `npx tsc --noEmit` passes after restoring nullable fallbacks for streak
  statuses in the dashboard.
- The full `npm test` run is blocked by recap tests that attempt to connect to
  local PostgreSQL at `localhost:5432`; the connection is refused. This is not
  a passing full-suite result.
- Scoped ESLint reports an existing error in `src/app/dashboard/page.tsx:264`
  (`react-hooks/set-state-in-effect`) plus existing unused-variable and image
  warnings. The lint run therefore does not pass cleanly.
- The SQL plan was inspected with `EXPLAIN` only; it was not run with
  `EXPLAIN ANALYZE` and does not provide production latency.

To establish whether pool starvation caused the incident, capture a
representative deployment window after the fix and inspect server logs together
with `pg_stat_statements` `calls`/`outliers`. The current telemetry is not yet a
platform-wide request dashboard: request context is not passed by most routes,
database query timings are not correlated to request IDs, and the statistics
must accumulate representative traffic before they identify slow endpoints or
queries. The dashboard can still wait indefinitely on a stalled request because
the shared browser API client has no request timeout. Do not claim all endpoints
are fast, all loading states are bounded, or the incident is resolved based on
the current evidence. Do not add indexes or change compute sizing based on the
diagnostic-only sample.
