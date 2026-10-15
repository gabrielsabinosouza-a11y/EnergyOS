import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) { const i=line.indexOf('='); if(i>0){const k=line.slice(0,i).trim(),v=line.slice(i+1).trim(); if(k&&!process.env[k])process.env[k]=v;} }
import { Pool } from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const PID='0e719da0-f486-469c-b27f-9b3b5612fb50';
for (const m of ['2026-08-01','2026-09-01','2026-10-01']) {
  const r=await p.query(`select count(*) c from monthly_recap_history where profile_id=$1 and recap_month=$2`,[PID,m]);
  const r2=await p.query(`select id, generation_number from monthly_recaps where profile_id=$1 and recap_month=$2`,[PID,m]);
  console.log(m, 'historyCount=',r.rows[0].c, 'recaps=',r2.rows.map(x=>({id:x.id,gen:x.generation_number})));
}
await p.end();
