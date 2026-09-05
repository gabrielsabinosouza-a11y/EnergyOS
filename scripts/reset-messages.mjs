/**
 * Resets ALL chat messages in the production database: group messages, direct
 * messages and their dependencies (reactions + pins).
 *
 * Preserves: groups, group members, friendships and per-conversation read state.
 *
 * Run: npm run db:reset-messages -- --confirm
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envFile of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", envFile), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) return match[1].trim();
    } catch {
      // optional file
    }
  }
  return undefined;
}

if (!process.argv.includes("--confirm")) {
  console.error("Abortando: rode com --confirm para apagar as mensagens.");
  console.error("  npm run db:reset-messages -- --confirm");
  process.exit(1);
}

const connectionString = await resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

const TABLES = ["group_messages", "direct_messages", "message_reactions", "pinned_messages"];

const count = async (client, table) => {
  const r = await client.query(`select count(*)::int as c from ${table}`);
  return r.rows[0].c;
};

try {
  const client = await pool.connect();
  console.log("── Tabelas afetadas (antes) ──");
  for (const t of TABLES) {
    console.log(`${t.padEnd(20)} ${await count(client, t)}`);
  }

  await client.query("begin");
  try {
    // Dependencies first (reactions/pins reference message ids).
    for (const t of ["message_reactions", "pinned_messages", "group_messages", "direct_messages"]) {
      const r = await client.query(`delete from ${t}`);
      console.log(`delete ${t.padEnd(20)} ${r.rowCount} linha(s)`);
    }
    await client.query("commit");
    console.log("✓ commit");
  } catch (error) {
    await client.query("rollback");
    console.error("✗ rollback:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log("── Tabelas afetadas (depois) ──");
  for (const t of TABLES) {
    console.log(`${t.padEnd(20)} ${await count(client, t)}`);
  }
  client.release();
} finally {
  await pool.end();
}