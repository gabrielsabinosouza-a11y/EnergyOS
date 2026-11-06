import { Pool } from "pg";
import fs from "node:fs";

const txt = fs.readFileSync(".env.local", "utf8");
let url = null;
for (const line of txt.split("\n")) {
  if (line.startsWith("DATABASE_URL=")) {
    url = line.slice("DATABASE_URL=".length).trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1);
    }
    break;
  }
}
console.log("URL present:", !!url);
if (url) {
  try {
    const u = new URL(url);
    console.log("HOST:", u.hostname);
    console.log("DB:", u.pathname);
  } catch(e) { console.log("URL parse failed:", e.message); }
}
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
try {
  const r = await pool.query("select current_database(), current_user, current_schema()");
  console.log("CURRENT:", r.rows);
  const t = await pool.query("select count(*)::int as c from information_schema.tables where table_schema='public'");
  console.log("PUBLIC TABLE COUNT:", t.rows);
  const p = await pool.query("select count(*)::int as c from profiles");
  console.log("PROFILES COUNT:", p.rows);
} catch(e) {
  console.log("ERROR:", e.code, e.message);
  console.log("DETAIL:", e.detail);
} finally {
  await pool.end();
}
