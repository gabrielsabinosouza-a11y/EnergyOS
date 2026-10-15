import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='monthly_recaps' ORDER BY ordinal_position`);
  console.log("monthly_recaps columns:");
  console.table(cols.rows.map(r => ({col: r.column_name, type: r.data_type})));
  const cons = await pool.query(`SELECT conname, contype FROM pg_constraint WHERE conrelid='monthly_recaps'::regclass`);
  console.log("constraints:");
  console.table(cons.rows);
  const cnt = await pool.query(`SELECT count(*) FROM monthly_recaps`);
  console.log("recaps count:", cnt.rows[0].count);
  const sample = await pool.query(`SELECT id, profile_id, recap_month, total_focus_minutes, longest_streak, total_xp, status, generation_number, league_tier, generated_at FROM monthly_recaps LIMIT 5`);
  console.log("sample:", JSON.stringify(sample.rows, null, 2));
} catch (e) { console.error("ERR", e.message); } finally { await pool.end(); }
