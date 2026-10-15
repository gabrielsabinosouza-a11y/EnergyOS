import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}
import { Pool } from 'pg';
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const PID = '0e719da0-f486-469c-b27f-9b3b5612fb50';
  const q = `select id, started_at, ended_at, duration_minutes, target_duration_minutes
             from focus_sessions
             where profile_id = $1 and ended_at is not null
               and ((ended_at at time zone 'America/Sao_Paulo')::date in ('2026-09-30','2026-10-01'))
             order by ended_at`;
  const r = await p.query(q, [PID]);
  console.log('focus sessions on Sep 30 / Oct 1 (SP dates):');
  for (const row of r.rows) {
    const spEnd = new Date(row.ended_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log(row.id, 'UTC=', String(row.ended_at).slice(0, 24), 'SP=', spEnd, 'dur=', row.duration_minutes, 'target=', row.target_duration_minutes);
  }
  const q2 = `select id, created_at, source, xp_amount
              from xp_ledger
              where profile_id = $1
                and ((created_at at time zone 'America/Sao_Paulo')::date in ('2026-09-30','2026-10-01'))
              order by created_at`;
  const r2 = await p.query(q2, [PID]);
  console.log('xp ledger on Sep 30 / Oct 1 (SP dates):');
  for (const row of r2.rows) {
    const sp = new Date(row.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log(row.id, 'UTC=', String(row.created_at).slice(0, 24), 'SP=', sp, 'src=', row.source, 'xp=', row.xp_amount);
  }
  const cur = await p.query(`select coalesce(sum(duration_minutes),0) m from focus_sessions where profile_id=$1 and ended_at is not null and started_at>='2026-09-01'::date and started_at<'2026-10-01'::date`, [PID]);
  const curxp = await p.query(`select coalesce(sum(xp_amount),0) x from xp_ledger where profile_id=$1 and created_at>='2026-09-01'::timestamp and created_at<'2026-10-01'::timestamp`, [PID]);
  const sp = await p.query(`select coalesce(sum(duration_minutes),0) m from focus_sessions where profile_id=$1 and ended_at is not null and started_at >= '2026-09-01T03:00:00Z'::timestamptz and started_at < '2026-10-01T03:00:00Z'::timestamptz`, [PID]);
  const spxp = await p.query(`select coalesce(sum(xp_amount),0) x from xp_ledger where profile_id=$1 and created_at >= '2026-09-01T03:00:00Z'::timestamptz and created_at < '2026-10-01T03:00:00Z'::timestamptz`, [PID]);
  console.log('\nSeptember focus: UTC-boundary (current code) =', cur.rows[0].m, '| SP-boundary (correct) =', sp.rows[0].m);
  console.log('September XP:     UTC-boundary (current code) =', curxp.rows[0].x, '| SP-boundary (correct) =', spxp.rows[0].x);
  await p.end();
})();
