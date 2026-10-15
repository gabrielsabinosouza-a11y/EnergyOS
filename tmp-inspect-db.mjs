import { readFileSync } from 'node:fs';
import pg from 'pg';

// Load .env.local
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PID = '0e719da0-f486-469c-b27f-9b3b5612fb50';

async function main() {
  // Tables list
  const tables = await pool.query(`select tablename from pg_tables where schemaname='public' order by tablename`);
  console.log('TABLES:', tables.rows.map(r => r.tablename).join(', '));

  // monthly_recaps
  console.log('\n=== monthly_recaps (all) ===');
  const recaps = await pool.query(`select id, profile_id, recap_month, total_focus_minutes, longest_streak, total_xp, league_tier, league_promoted, productivity_tag, generated_at, generation_number from monthly_recaps order by profile_id, recap_month`);
  console.table(recaps.rows);

  console.log('\n=== monthly_recaps for test profile ===');
  const mine = await pool.query(`select * from monthly_recaps where profile_id = $1 order by recap_month`, [PID]);
  console.table(mine.rows);

  // duplicates check
  console.log('\n=== duplicates (profile_id, recap_month) ===');
  const dups = await pool.query(`select profile_id, recap_month, count(*) c from monthly_recaps group by 1,2 having count(*) > 1`);
  console.table(dups.rows);

  // profiles
  console.log('\n=== profiles ===');
  const profs = await pool.query(`select id, username, email, created_at from profiles order by created_at limit 10`);
  console.table(profs.rows);

  // focus sessions sample
  console.log('\n=== focus_sessions count ===');
  const fc = await pool.query(`select count(*) from focus_sessions`);
  console.log('total:', fc.rows[0].count);
  const fsm = await pool.query(`select profile_id, date_trunc('month', ended_at) m, count(*), sum(duration_minutes) from focus_sessions where ended_at is not null group by 1,2 order by 1,2`);
  console.table(fsm.rows);

  // xp_ledger sample
  console.log('\n=== xp_ledger counts by month ===');
  const xp = await pool.query(`select profile_id, date_trunc('month', created_at) m, count(*), sum(xp_amount) from xp_ledger group by 1,2 order by 1,2`);
  console.table(xp.rows);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
