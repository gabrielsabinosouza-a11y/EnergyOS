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
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // Try the next environment file.
    }
  }
  throw new Error("DATABASE_URL não configurada.");
}

const connectionString = await resolveDatabaseUrl();
const isNeon = /neon\.tech/.test(connectionString);
const client = new pg.Client({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(`
    create table if not exists group_invites (
      id bigserial primary key,
      group_id bigint not null references groups(id) on delete cascade,
      invited_profile_id text not null references profiles(id) on delete cascade,
      invited_by_profile_id text not null references profiles(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
      created_at timestamptz not null default now(),
      responded_at timestamptz
    );
    create index if not exists group_invites_invited_profile_idx
      on group_invites(invited_profile_id, status);
    create index if not exists group_invites_group_idx
      on group_invites(group_id, status);
    create unique index if not exists group_invites_pending_unique_idx
      on group_invites(group_id, invited_profile_id) where status = 'pending';
  `);
  console.log("Migração de group_invites aplicada com sucesso.");
} finally {
  await client.end();
}
