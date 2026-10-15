import { readFileSync } from 'node:fs';
const env = readFileSync('/home/gabriel/Documentos/EnergyOS/.env.local', 'utf8');
for (const line of env.split('\n')) { const i=line.indexOf('='); if(i>0){const k=line.slice(0,i).trim(),v=line.slice(i+1).trim(); if(k&&!process.env[k])process.env[k]=v;} }
import { Pool } from 'pg';
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const r=await p.query(`select column_name,data_type from information_schema.columns where table_name='xp_ledger' order by ordinal_position`);
console.table(r.rows);
const r2=await p.query(`select column_name,data_type from information_schema.columns where table_name='monthly_recaps' order by ordinal_position`);
console.table(r2.rows);
await p.end();
