import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) { const i=line.indexOf('='); if(i>0){const k=line.slice(0,i).trim(),v=line.slice(i+1).trim(); if(k&&!process.env[k])process.env[k]=v;} }
import { Pool } from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const PID='0e719da0-f486-469c-b27f-9b3b5612fb50';
const q=`select id, started_at, duration_minutes from focus_sessions where profile_id=$1 and ended_at is not null and ((started_at at time zone 'America/Sao_Paulo')::date in ('2026-07-31','2026-08-01','2026-08-31','2026-09-01')) order by started_at`;
const r=await p.query(q,[PID]);
console.log('focus sessions near Jul31/Aug1 and Aug31/Sep1 boundaries (SP):');
for(const row of r.rows){
  const sp=new Date(row.started_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  console.log(row.id,'UTC=',String(row.started_at).slice(0,24),'SP=',sp,'dur=',row.duration_minutes);
}
const spwin=await p.query(`select coalesce(sum(duration_minutes),0) m from focus_sessions where profile_id=$1 and ended_at is not null and started_at >= '2026-08-01T03:00:00Z'::timestamptz and started_at < '2026-09-01T03:00:00Z'::timestamptz`,[PID]);
console.log('SP-correct August focus minutes:', spwin.rows[0].m, '(stored recap says 740)');
await p.end();
