/**
 * Cleanup script for duplicate garden entries.
 *
 * Problem: `plantGardenEntries` had no idempotency guard, so if startFocusSession
 * was called twice (retry, React Strict Mode, focus-room + solo double-start),
 * duplicate garden_entries rows were created. The getGardenEntries query then
 * generates energy entries for ALL of them, multiplying the garden count.
 *
 * This script removes the excess garden entries, keeping only the expected number
 * per session (1 for <60min, 2 for 60-89min, 4 for 90+min). It keeps the
 * lowest-ID rows (the originals) and deletes the rest.
 *
 * Usage:
 *   npx tsx scripts/cleanup-garden-duplicates.ts              # Dry run (default)
 *   npx tsx scripts/cleanup-garden-duplicates.ts --apply      # Apply changes
 *   npx tsx scripts/cleanup-garden-duplicates.ts --apply <profile-id>  # Apply for specific profile
 *
 * IMPORTANT: Run the diagnostic script first:
 *   npx tsx scripts/diagnose-focus-data.ts
 */

import pool from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const profileId = args.find((a) => a !== "--apply") ?? null;

  if (!apply) {
    console.log("Dry run mode — no changes will be made.");
    console.log("Add --apply to actually delete duplicate entries.\n");
  }

  const whereProfile = profileId ? "AND ge.profile_id = $1" : "";
  const params: (string | number)[] = profileId ? [profileId] : [];

  // Step 1: Count duplicates before cleanup
  const before = await pool.query(
    `SELECT ge.profile_id, ge.session_id, COUNT(*)::int as garden_rows,
            fs.duration_minutes,
            CASE WHEN fs.duration_minutes >= 90 THEN 4
                 WHEN fs.duration_minutes >= 60 THEN 2
                 ELSE 1 END as expected_rows,
            COUNT(*) - CASE WHEN fs.duration_minutes >= 90 THEN 4
                            WHEN fs.duration_minutes >= 60 THEN 2
                            ELSE 1 END as excess_rows
       FROM garden_entries ge
       JOIN focus_sessions fs ON fs.id = ge.session_id AND fs.profile_id = ge.profile_id
      WHERE 1=1 ${whereProfile}
      GROUP BY ge.profile_id, ge.session_id, fs.duration_minutes
     HAVING COUNT(*) > CASE WHEN fs.duration_minutes >= 90 THEN 4
                            WHEN fs.duration_minutes >= 60 THEN 2
                            ELSE 1 END
     ORDER BY excess_rows DESC`,
    params,
  );

  const totalExcess = before.rows.reduce((sum, row) => sum + Number(row.excess_rows), 0);
  console.log(`Found ${before.rows.length} sessions with duplicate garden entries.`);
  console.log(`Total excess rows to remove: ${totalExcess}\n`);

  if (before.rows.length === 0) {
    console.log("✓ No duplicates found. Nothing to clean up.");
    await pool.end();
    process.exit(0);
  }

  // Show details
  for (const row of before.rows) {
    console.log(
      `  Session ${row.session_id} (${row.profile_id.slice(0, 8)}...): ` +
      `${row.garden_rows} rows, expected ${row.expected_rows}, excess ${row.excess_rows} ` +
      `(${row.duration_minutes}min session)`
    );
  }

  if (!apply) {
    console.log("\nDry run complete. Run with --apply to delete the excess rows.");
    await pool.end();
    process.exit(0);
  }

  // Step 2: Delete excess rows, keeping the lowest-ID rows (originals)
  console.log("\nApplying cleanup...");
  const deleted = await pool.query(
    `WITH ranked AS (
       SELECT ge.id, ge.profile_id, ge.session_id,
              ROW_NUMBER() OVER (
                PARTITION BY ge.profile_id, ge.session_id
                ORDER BY ge.id
              ) AS rn,
              fs.duration_minutes
         FROM garden_entries ge
         JOIN focus_sessions fs ON fs.id = ge.session_id AND fs.profile_id = ge.profile_id
        WHERE 1=1 ${whereProfile}
     )
     DELETE FROM garden_entries ge
     USING ranked r
     WHERE ge.id = r.id
       AND r.rn > CASE WHEN r.duration_minutes >= 90 THEN 4
                       WHEN r.duration_minutes >= 60 THEN 2
                       ELSE 1 END`,
  );

  console.log(`✓ Deleted ${deleted.rowCount ?? 0} excess garden entries.`);

  // Step 3: Verify after cleanup
  const after = await pool.query(
    `SELECT ge.profile_id, ge.session_id, COUNT(*)::int as garden_rows,
            fs.duration_minutes,
            CASE WHEN fs.duration_minutes >= 90 THEN 4
                 WHEN fs.duration_minutes >= 60 THEN 2
                 ELSE 1 END as expected_rows
       FROM garden_entries ge
       JOIN focus_sessions fs ON fs.id = ge.session_id AND fs.profile_id = ge.profile_id
      WHERE 1=1 ${whereProfile}
      GROUP BY ge.profile_id, ge.session_id, fs.duration_minutes
     HAVING COUNT(*) > CASE WHEN fs.duration_minutes >= 90 THEN 4
                            WHEN fs.duration_minutes >= 60 THEN 2
                            ELSE 1 END`,
    params,
  );

  if (after.rows.length === 0) {
    console.log("✓ Verification passed: no remaining duplicates.");
  } else {
    console.log(`⚠ Warning: ${after.rows.length} sessions still have duplicates.`);
  }

  // Step 4: Summary
  const summary = await pool.query(
    `SELECT COUNT(*)::int as total_rows, COUNT(DISTINCT session_id)::int as distinct_sessions
       FROM garden_entries ge WHERE 1=1 ${whereProfile}`,
    profileId ? [profileId] : [],
  );
  console.log(`\nGarden entries after cleanup: ${summary.rows[0].total_rows} rows, ${summary.rows[0].distinct_sessions} sessions.`);
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
