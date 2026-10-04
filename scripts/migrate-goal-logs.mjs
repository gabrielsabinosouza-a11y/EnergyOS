// Adds the goal_logs table + index (idempotent) — daily check-in logs for goals.
// Mirrors src/db-schema.sql and ensureGoalLogsSchema() in src/lib/db/goal-logs.ts.
// Run: npm run db:migrate-goal-logs
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
      // arquivo opcional
    }
  }
  return undefined;
}

const connectionString = await resolveDatabaseUrl();

if (!connectionString) {
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:migrate-goal-logs");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.NODE_ENV === "production" || process.env.DATABASE_SSL_STRICT === "true";
const client = new pg.Client({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: sslStrict } : undefined,
});

await client.connect();

const statements = [
  `create table if not exists goal_logs (
     id bigserial primary key,
     profile_id text not null references profiles(id) on delete cascade,
     goal_id bigint not null references goals(id) on delete cascade,
     log_date date not null,
     amount numeric(8,2) not null default 1 check (amount >= 0),
     created_at timestamptz not null default now(),
     unique (goal_id, log_date)
   )`,
  `create index if not exists goal_logs_profile_date_idx on goal_logs(profile_id, log_date)`,
];

try {
  for (const sql of statements) {
    await client.query(sql);
  }
  console.log("goal_logs table + index ensured.");
} finally {
  await client.end();
}