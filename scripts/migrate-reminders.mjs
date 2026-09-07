// Adds the onboarding + reminder columns to user_settings (idempotent).
// Run: npm run db:migrate-reminders
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
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:migrate-reminders");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);
const sslStrict = process.env.NODE_ENV === "production" || process.env.DATABASE_SSL_STRICT === "true";

const client = new pg.Client({
  connectionString,
  ssl: isNeon ? (sslStrict ? { rejectUnauthorized: true } : { rejectUnauthorized: false }) : undefined,
});

await client.connect();

// Mirrors src/db-schema.sql so the migration is a no-op on fresh installs.
const statements = [
  `alter table user_settings add column if not exists onboarding_completed boolean not null default false`,
  `alter table user_settings add column if not exists reminder_checkin_enabled boolean not null default false`,
  `alter table user_settings add column if not exists reminder_focus_enabled boolean not null default false`,
  `alter table user_settings add column if not exists reminder_sleep_enabled boolean not null default false`,
];

try {
  for (const sql of statements) {
    await client.query(sql);
  }
  console.log("Columns ensured: onboarding_completed, reminder_checkin_enabled, reminder_focus_enabled, reminder_sleep_enabled");
} finally {
  await client.end();
}