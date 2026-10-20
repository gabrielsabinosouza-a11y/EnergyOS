import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

// XP Boost purchase idempotency: creates the `xp_boost_purchase_requests`
// table from migrations/2026-10-18-xp-boost-purchase-idempotency.sql.
// Idempotent (create table if not exists) — safe to run multiple times.
async function readDatabaseUrl() {
  for (const file of [".env", ".env.local"]) {
    try {
      const contents = await readFile(join(process.cwd(), file), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match) return match[1].trim();
    } catch {
      // arquivo ausente — tenta o próximo
    }
  }
  throw new Error("DATABASE_URL não encontrada em .env nem .env.local");
}

const connectionString = await readDatabaseUrl();
const isNeon = /neon\.tech/.test(connectionString);
const pool = new pg.Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});
try {
  const r1 = await pool.query(`
    create table if not exists xp_boost_purchase_requests (
      profile_id text not null references profiles(id) on delete cascade,
      idempotency_key uuid not null,
      requested_quantity integer not null,
      balance integer not null,
      potion_quantity integer not null,
      created_at timestamptz not null default now(),
      primary key (profile_id, idempotency_key)
    )`);
  console.log("xp_boost_purchase_requests table:", r1.command, "rows:", r1.rowCount);
  const check = await pool.query(
    `select column_name from information_schema.columns where table_name='xp_boost_purchase_requests' order by ordinal_position`);
  console.log("columns:", check.rows.map((r) => r.column_name).join(", "));
} finally {
  await pool.end();
}
