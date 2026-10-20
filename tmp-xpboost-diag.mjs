// Diagnostic: check whether the tables used by the xp-boost purchase flow
// exist in the live DB, then dry-run the purchase transaction (rolled back).
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv(".env");
loadEnv(".env.local");

const url = process.env.DATABASE_URL;
console.log("DATABASE_URL host:", url ? new URL(url).host : "MISSING");

const isNeon = /neon\.tech/.test(url ?? "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});

const tables = [
  "profiles",
  "user_settings",
  "user_potions",
  "active_xp_boost",
  "xp_boost_purchase_requests",
];
const res = await pool.query(
  `select table_name from information_schema.tables where table_schema='public' and table_name = any($1)`,
  [tables],
);
const found = new Set(res.rows.map((r) => r.table_name));
for (const t of tables) console.log(`table ${t}: ${found.has(t) ? "OK" : "MISSING"}`);

// Dry-run the purchase inside a rolled-back transaction to surface the error.
const client = await pool.connect();
try {
  const profiles = await client.query(`select id from profiles limit 1`);
  const profileId = profiles.rows[0]?.id;
  console.log("test profile:", profileId ?? "NONE");
  if (profileId) {
    await client.query("begin");
    const settings = await client.query(
      `select coins from user_settings where profile_id = $1 for update`,
      [profileId],
    );
    console.log("user_settings row:", settings.rows[0] ?? "MISSING");
    try {
      const inv = await client.query(
        `select quantity from user_potions where profile_id = $1 and item_type = $2 for update`,
        [profileId, "xp_boost_2x"],
      );
      console.log("user_potions row:", inv.rows[0] ?? "none (ok, upsert on purchase)");
      const up = await client.query(
        `insert into user_potions (profile_id, item_type, quantity, updated_at)
         values ($1, $2, $3, now())
         on conflict (profile_id, item_type)
         do update set quantity = user_potions.quantity + excluded.quantity, updated_at = now()
         returning quantity`,
        [profileId, "xp_boost_2x", 1],
      );
      console.log("upsert potions ->", up.rows[0]);
      const idem = await client.query(
        `insert into xp_boost_purchase_requests
           (profile_id, idempotency_key, requested_quantity, balance, potion_quantity)
         values ($1, $2, $3, $4, $5)`,
        [profileId, crypto.randomUUID(), 1, 0, 1],
      );
      console.log("idempotency insert -> ok", idem.rowCount);
    } finally {
      await client.query("rollback");
      console.log("transaction rolled back (no data changed)");
    }
  }
} catch (e) {
  console.error("DRY-RUN ERROR:", e.message);
  console.error("code:", e.code);
  try { await client.query("rollback"); } catch {}
} finally {
  client.release();
  await pool.end();
}
