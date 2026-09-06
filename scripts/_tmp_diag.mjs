import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
const contents = await readFile(join(process.cwd(), ".env"), "utf8");
const connectionString = contents.match(/^DATABASE_URL=(.*)$/m)[1].trim();
const pool = new pg.Pool({ connectionString });
try {
  const cols = await pool.query(
    `select column_name from information_schema.columns where table_name = 'focus_sessions' order by ordinal_position`);
  console.log("focus_sessions columns:", cols.rows.map(r => r.column_name).join(", "));
  const prog = await pool.query(
    `select achievement_id, current_value, unlocked_tier, is_featured, featured_order, unlocked_at::text
     from user_achievement_progress
     where profile_id = '0e719da0-f486-469c-b27f-9b3b5612fb50'
     order by featured_order nulls last, achievement_id`);
  console.log("\nCAFEINADO user_achievement_progress:");
  console.table(prog.rows);
  const feat = await pool.query(
    `select count(*)::int as featured_count from user_achievement_progress
     where is_featured = true`);
  console.log("global featured rows:", feat.rows[0].featured_count);
} finally { await pool.end(); }
