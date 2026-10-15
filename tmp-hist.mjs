import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) { const i=line.indexOf('='); if(i>0){const k=line.slice(0,i).trim(),v=line.slice(i+1).trim(); if(k&&!process.env[k])process.env[k]=v;} }
import { Pool } from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const PID='0e719da0-f486-469c-b27f-9b3b5612fb50';
const r=await p.query(`select recap_id, profile_id, recap_month, generation_number, generated_at from monthly_recap_history where profile_id=$1 and recap_month='2026-09-01' order by generation_number`,[PID]);
console.table(r.rows);
const r2=await p.query(`select id, generation_number from monthly_recaps where profile_id=$1 and recap_month='2026-09-01'`,[PID]);
console.table(r2.rows);
await p.end();
