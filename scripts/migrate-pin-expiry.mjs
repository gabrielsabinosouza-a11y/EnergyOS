import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
const contents = await readFile(join(process.cwd(), ".env"), "utf8");
const connectionString = contents.match(/^DATABASE_URL=(.*)$/m)[1].trim();
const pool = new pg.Pool({ connectionString });
try {
  // Pinned-messages migration (Step 3): pin expiry + allow up to 3 pins per conversation.
  const r1 = await pool.query(`alter table pinned_messages add column if not exists expires_at timestamptz`);
  console.log("expires_at column:", r1.command, "rows:", r1.rowCount);
  const r2 = await pool.query(`drop index if exists pinned_messages_one_per_conversation_idx`);
  console.log("one-per-conversation index dropped:", r2.command, "rows:", r2.rowCount);
  const cols = await pool.query(`select column_name from information_schema.columns where table_name='pinned_messages' order by ordinal_position`);
  console.log("pinned_messages columns:", cols.rows.map((r) => r.column_name).join(", "));
  const idx = await pool.query(`select indexname from pg_indexes where tablename='pinned_messages'`);
  console.log("pinned_messages indexes:", idx.rows.map((r) => r.indexname).join(", "));
} finally { await pool.end(); }