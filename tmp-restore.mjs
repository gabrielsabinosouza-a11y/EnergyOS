import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) { const i=line.indexOf('='); if(i>0){const k=line.slice(0,i).trim(),v=line.slice(i+1).trim(); if(k&&!process.env[k])process.env[k]=v;} }
import { Pool } from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const PID='0e719da0-f486-469c-b27f-9b3b5612fb50';
// Restore September generation_number to its pre-test value (17)
await p.query(`UPDATE monthly_recaps SET generation_number = 17 WHERE profile_id=$1 AND recap_month='2026-09-01'`,[PID]);
// Check leftover boundary test rows
const f=await p.query(`select count(*) c from focus_sessions where profile_id=$1 and source_id IS NULL and duration_minutes=30`,[PID]);
console.log('leftover focus rows:',f.rows[0].c);
const x=await p.query(`select count(*) c from xp_ledger where profile_id=$1 and source='focus' and source_id in ('boundary_sep','boundary_oct')`,[PID]);
console.log('leftover xp rows:',x.rows[0].c);
// Show current recap state
const r=await p.query(`select recap_month, generation_number, status, total_xp from monthly_recaps where profile_id=$1 order by recap_month`,[PID]);
console.table(r.rows);
await p.end();
