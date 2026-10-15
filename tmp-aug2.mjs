import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) { const i=line.indexOf('='); if(i>0){const k=line.slice(0,i).trim(),v=line.slice(i+1).trim(); if(k&&!process.env[k])process.env[k]=v;} }
import { Pool } from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const PID='0e719da0-f486-469c-b27f-9b3b5612fb50';
const a=await p.query(`select coalesce(sum(xp_amount),0) x from xp_ledger where profile_id=$1 and created_at>='2026-08-01'::timestamp and created_at<'2026-09-01'::timestamp`,[PID]);
const b=await p.query(`select coalesce(sum(xp_amount),0) x from xp_ledger where profile_id=$1 and created_at >= '2026-08-01T03:00:00Z'::timestamptz and created_at < '2026-09-01T03:00:00Z'::timestamptz`,[PID]);
console.log('August XP: UTC-window (buggy code)=',a.rows[0].x,' SP-window (correct)=',b.rows[0].x,'(stored recap=0)');
const c=await p.query(`select id, created_at, source, xp_amount from xp_ledger where profile_id=$1 and ((created_at at time zone 'America/Sao_Paulo')::date in ('2026-07-31','2026-08-01','2026-08-31','2026-09-01')) order by created_at`,[PID]);
for(const row of c.rows){ const sp=new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}); console.log(row.id,'UTC=',String(row.created_at).slice(0,24),'SP=',sp,'src=',row.source,'xp=',row.xp_amount);}
await p.end();
