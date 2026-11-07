import pool from "../src/lib/db";

async function diagnose() {
  console.log("=== FOCUS SESSION RECAP DIAGNOSIS ===\n");

  // 1. Check for November 2026 recap
  console.log("1. November 2026 recap:");
  const recap = await pool.query(
    `SELECT profile_id, recap_month, total_focus_minutes, longest_streak, status
     FROM monthly_recaps
     WHERE recap_month = '2026-11-01'
     ORDER BY total_focus_minutes DESC
     LIMIT 5`
  );
  console.log(recap.rows);

  // 2. Check focus_sessions table structure
  console.log("\n2. Focus sessions table columns:");
  const schema = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'focus_sessions'
     ORDER BY ordinal_position`
  );
  console.log(schema.rows.map(r => `${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

  // 3. Check for outliers in November 2026
  console.log("\n3. Outliers in November 2026 focus_sessions:");
  const outliers = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes, started_at, ended_at,
            EXTRACT(DAY FROM (ended_at - started_at)) as days_span,
            end_reason, focused_seconds
     FROM focus_sessions
     WHERE started_at >= '2026-11-01T03:00:00Z' AND started_at < '2026-12-01T03:00:00Z'
     AND (
       duration_minutes > 1440  -- > 1 day
       OR (ended_at - started_at) > interval '2 days'
       OR duration_minutes > target_duration_minutes * 2
     )
     ORDER BY duration_minutes DESC
     LIMIT 20`
  );
  console.log(`Found ${outliers.rows.length} outliers:`);
  console.log(outliers.rows);

  // 4. Check for duplicates (same session saved multiple times)
  console.log("\n4. Duplicate sessions (same profile, same started_at):");
  const dupes = await pool.query(
    `SELECT profile_id, started_at, COUNT(*) as count, ARRAY_AGG(id) as ids
     FROM focus_sessions
     WHERE started_at >= '2026-11-01T03:00:00Z' AND started_at < '2026-12-01T03:00:00Z'
     GROUP BY profile_id, started_at
     HAVING COUNT(*) > 1
     LIMIT 10`
  );
  console.log(`Found ${dupes.rows.length} duplicate groups:`);
  console.log(dupes.rows);

  // 5. Check for sessions with no ended_at
  console.log("\n5. Sessions without ended_at in November 2026:");
  const noEnd = await pool.query(
    `SELECT COUNT(*) as count, profile_id
     FROM focus_sessions
     WHERE started_at >= '2026-11-01T03:00:00Z' AND started_at < '2026-12-01T03:00:00Z'
     AND ended_at IS NULL
     GROUP BY profile_id`
  );
  console.log(noEnd.rows);

  // 6. Check if duration_minutes is stored in seconds somewhere
  console.log("\n6. Sessions with suspiciously large duration_minutes:");
  const huge = await pool.query(
    `SELECT id, profile_id, duration_minutes, target_duration_minutes, 
            focused_seconds, total_paused_seconds,
            EXTRACT(EPOCH FROM (ended_at - started_at)) as actual_seconds
     FROM focus_sessions
     WHERE started_at >= '2026-11-01T03:00:00Z' AND started_at < '2026-12-01T03:00:00Z'
     AND duration_minutes > 500
     ORDER BY duration_minutes DESC
     LIMIT 10`
  );
  console.log(`Found ${huge.rows.length} huge sessions:`);
  console.log(huge.rows);

  // 7. Check the recap calculation query
  console.log("\n7. Recap calculation for November 2026 (sample profile):");
  if (recap.rows[0]) {
    const profileId = recap.rows[0].profile_id;
    const calc = await pool.query(
      `SELECT 
        COALESCE(SUM(EXTRACT(EPOCH FROM LEAST(ended_at, $3::timestamptz) - GREATEST(started_at, $2::timestamptz)) / 60), 0) AS minutes,
        COUNT(*) as session_count,
        SUM(duration_minutes) as sum_duration_minutes,
        MAX(duration_minutes) as max_duration_minutes,
        MIN(duration_minutes) as min_duration_minutes
       FROM focus_sessions
      WHERE profile_id = $1
        AND ended_at IS NOT NULL
        AND ended_at > $2::timestamptz
        AND started_at < $3::timestamptz`,
      [profileId, '2026-11-01T03:00:00Z', '2026-12-01T03:00:00Z']
    );
    console.log(calc.rows[0]);
  }

  // 8. Check if there's a status column
  console.log("\n8. Checking for status column in focus_sessions:");
  const hasStatus = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'focus_sessions' AND column_name = 'status'
     ) as has_status`
  );
  console.log(hasStatus.rows[0]);

  await pool.end();
}

diagnose().catch(console.error);
