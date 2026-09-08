/**
 * Restores deleted chat history (group_messages, direct_messages,
 * message_reactions, pinned_messages) from a Neon point-in-time branch back
 * into the main database.
 *
 * Deleted rows are gone from the live DB, so this pulls them from a branch
 * that Neon created at a timestamp BEFORE the wipe:
 *
 *   1. Opens https://console.neon.tech → your project → Branching
 *   2. Create a branch at a point-in-time chosen from BEFORE 2026-09-06
 *      (the day chat was reset) — e.g. 2026-09-06 00:00 UTC.
 *   3. Copy that branch's connection string and run:
 *
 *   DATABASE_URL_RESTORE_SOURCE="postgresql://..." npm run db:restore-messages -- --apply
 *
 * Safe to run repeatedly: only rows whose ids are missing locally are
 * inserted, and sequences are advanced only as needed.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function resolveUrl(name, pattern) {
  if (process.env[name]) return process.env[name];
  for (const envFile of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", envFile), "utf8");
      const match = contents.match(pattern);
      if (match?.[1]) return match[1].trim();
    } catch {
      // arquivo opcional
    }
  }
  return undefined;
}

const apply = process.argv.includes("--apply");
const argUrl = process.argv.find((a) => a.startsWith("postgres://") || a.startsWith("postgresql://"));

const mainUrl = await resolveUrl("DATABASE_URL", /^DATABASE_URL=(.*)$/m);
const sourceUrl = argUrl ?? (await resolveUrl("DATABASE_URL_RESTORE_SOURCE", /^DATABASE_URL_RESTORE_SOURCE=(.*)$/m));

if (!mainUrl) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}
if (!sourceUrl) {
  console.error(
    "Falta a connection string do branch. Use DATABASE_URL_RESTORE_SOURCE ou passe a URL como argumento.",
  );
  process.exit(1);
}

const ssl = (url) => (/neon\.tech/.test(url) ? { rejectUnauthorized: process.env.NODE_ENV === "production" } : undefined);

const source = new pg.Client({ connectionString: sourceUrl, ssl: ssl(sourceUrl) });
const main = new pg.Client({ connectionString: mainUrl, ssl: ssl(mainUrl) });

const TABLES = [
  { name: "group_messages", columns: [
    "id", "group_id", "sender_id", "body", "message_type", "media_url",
    "media_duration_seconds", "media_file_name", "media_mime_type",
    "media_size_bytes", "created_at", "reply_to_id", "edited_at",
  ] },
  { name: "direct_messages", columns: [
    "id", "sender_id", "recipient_id", "body", "created_at", "reply_to_id",
    "edited_at", "message_type", "media_url", "media_duration_seconds",
    "media_file_name", "media_mime_type", "media_size_bytes",
  ] },
  { name: "message_reactions", columns: [
    "message_id", "message_kind", "user_id", "emoji", "created_at",
  ] },
  { name: "pinned_messages", columns: [
    "message_id", "message_kind", "conversation_id", "pinned_by", "created_at",
  ] },
];

try {
  await source.connect();
  await main.connect();
} catch (e) {
  console.error("Falha ao conectar:", e instanceof Error ? e.message : e);
  process.exit(1);
}

try {
  for (const table of TABLES) {
    const cols = table.columns.join(", ");
    const fromSource = await source.query(
      `select ${cols} from ${table.name} order by id`,
    );
    console.log(`\n${table.name}: ${fromSource.rowCount} linha(s) no branch`);

    let toInsert = fromSource.rows;

    if (table.name === "group_messages" || table.name === "direct_messages") {
      const mainIds = await main.query(`select id from ${table.name}`);
      const existingIds = new Set(mainIds.rows.map((r) => String(r.id)));
      toInsert = fromSource.rows.filter((r) => !existingIds.has(String(r.id)));
      console.log(
        `  → ${toInsert.length} ausente(s) no banco principal (já existiam ${fromSource.rows.length - toInsert.length})`,
      );
    }

    if (toInsert.length === 0) continue;

    if (!apply) {
      console.log(
        `  (dry-run) insert ${toInsert.length} linha(s) — rode com --apply para gravar`,
      );
      continue;
    }

    const placeholders = table.columns.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `insert into ${table.name} (${cols}) values (${placeholders}) on conflict do nothing`;

    const client = await main.connect();
    try {
      await client.query("begin");
      for (const row of toInsert) {
        await client.query(sql, table.columns.map((c) => row[c]));
      }
      await client.query("commit");
      console.log(`  ✓ ${toInsert.length} linha(s) restaurada(s).`);
    } catch (e) {
      await client.query("rollback");
      console.error(`  ✗ rollback em ${table.name}:`, e instanceof Error ? e.message : e);
    } finally {
      client.release();
    }
  }

  if (apply) {
    for (const seq of [
      ["group_messages_id_seq", "group_messages"],
      ["direct_messages_id_seq", "direct_messages"],
    ]) {
      const { rows } = await main.query(
        `select setval('${seq[0]}', greatest((select coalesce(max(id), 1) from ${seq[1]}), (select last_value from ${seq[0]})))`,
      );
      console.log(`\nsequence ${seq[0]} → ${rows[0].setval}`);
    }
  }
} finally {
  await source.end();
  await main.end();
}