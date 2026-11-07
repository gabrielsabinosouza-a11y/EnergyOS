import pool from "../src/lib/db";

async function findOutliers() {
  console.log("=== FOCUS SESSION OUTLIERS REPORT ===\n");

  // 1. Sessions with duration > 1 day
  console.log("1. Sessions with duration_minutes > 1440 (> 1 day):");
  const hugeDuration = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes, 
            started_at, ended_at, status, end_reason
     FROM focus_sessions
     WHERE duration_minutes > 1440
     ORDER BY duration_minutes DESC
     LIMIT 20`
  );
  console.log(`Found ${hugeDuration.rows.length} sessions`);
  if (hugeDuration.rows.length > 0) {
    console.table(hugeDuration.rows);
  }

  // 2. Sessions where ended_at - started_at > 2 days
  console.log("\n2. Sessions where time span > 2 days:");
  const hugeSpan = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes,
            started_at, ended_at, 
            EXTRACT(DAY FROM (ended_at - started_at)) as days_span,
            status, end_reason
     FROM focus_sessions
     WHERE ended_at IS NOT NULL
       AND (ended_at - started_at) > interval '2 days'
     ORDER BY (ended_at - started_at) DESC
     LIMIT 20`
  );
  console.log(`Found ${hugeSpan.rows.length} sessions`);
  if (hugeSpan.rows.length > 0) {
    console.table(hugeSpan.rows);
  }

  // 3. Sessions where duration_minutes > target_duration_minutes * 2
  console.log("\n3. Sessions where duration > 2x target:");
  const overTarget = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes,
            started_at, ended_at, status, end_reason
     FROM focus_sessions
     WHERE target_duration_minutes > 0
       AND duration_minutes > target_duration_minutes * 2
     ORDER BY (duration_minutes / target_duration_minutes) DESC
     LIMIT 20`
  );
  console.log(`Found ${overTarget.rows.length} sessions`);
  if (overTarget.rows.length > 0) {
    console.table(overTarget.rows);
  }

  // 4. Duplicate sessions (same profile, same started_at)
  console.log("\n4. Duplicate sessions (same profile + started_at):");
  const dupes = await pool.query(
    `SELECT profile_id, started_at, COUNT(*) as count, ARRAY_AGG(id) as ids,
            ARRAY_AGG(duration_minutes) as durations,
            ARRAY_AGG(status) as statuses
     FROM focus_sessions
     GROUP BY profile_id, started_at
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT 20`
  );
  console.log(`Found ${dupes.rows.length} duplicate groups`);
  if (dupes.rows.length > 0) {
    console.table(dupes.rows);
  }

  // 5. Sessions with ended_at in the future
  console.log("\n5. Sessions with ended_at in the future:");
  const futureEnd = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes,
            started_at, ended_at, status, end_reason
     FROM focus_sessions
     WHERE ended_at > now() + interval '1 day'
     ORDER BY ended_at DESC
     LIMIT 20`
  );
  console.log(`Found ${futureEnd.rows.length} sessions`);
  if (futureEnd.rows.length > 0) {
    console.table(futureEnd.rows);
  }

  // 6. Sessions with no ended_at (still open)
  console.log("\n6. Sessions with no ended_at (still open):");
  const noEnd = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes,
            started_at, status, end_reason,
            EXTRACT(DAY FROM (now() - started_at)) as days_open
     FROM focus_sessions
     WHERE ended_at IS NULL
     ORDER BY started_at ASC
     LIMIT 20`
  );
  console.log(`Found ${noEnd.rows.length} sessions`);
  if (noEnd.rows.length > 0) {
    console.table(noEnd.rows);
  }

  // 7. Summary by profile for November 2026
  console.log("\n7. November 2026 recap totals by profile:");
  const nov2026 = await pool.query(
    `SELECT profile_id, 
            COUNT(*) as session_count,
            SUM(duration_minutes) as total_minutes,
            MAX(duration_minutes) as max_minutes,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
            COUNT(CASE WHEN status = 'gave_up' THEN 1 END) as gave_up_count,
            COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_count
     FROM focus_sessions
     WHERE started_at >= '2026-11-01T03:00:00Z' AND started_at < '2026-12-01T03:00:00Z'
     GROUP BY profile_id
     ORDER BY total_minutes DESC
     LIMIT 10`
  );
  console.log(`Found ${nov2026.rows.length} profiles with sessions in Nov 2026`);
  if (nov2026.rows.length > 0) {
    console.table(nov2026.rows);
  }

  await pool.end();
}

findOutliers().catch(console.error);
