import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(here, "..", file), "utf8");
      const match = contents.match(/^DATABASE_URL=(.*)$/m);
      if (match?.[1]) return match[1].trim();
    } catch {
      // Optional local environment file.
    }
  }
  throw new Error("DATABASE_URL não encontrada no ambiente, .env.local ou .env.");
}

const connectionString = await resolveDatabaseUrl();
const client = new pg.Client({
  connectionString,
  ssl: /neon\.tech/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  const migration = await readFile(join(here, "..", "migrations", "2026-11-03-league-tier-expansion.sql"), "utf8");
  await client.query(migration);
  console.log("League tier expansion migration applied.");
} finally {
  await client.end();
}
