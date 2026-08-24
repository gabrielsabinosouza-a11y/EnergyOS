import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "..", "src", "db-schema.sql");

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
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:init");
  process.exit(1);
}

const isNeon = /neon\.tech/.test(connectionString);

const client = new pg.Client({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});

try {
  const schema = await readFile(sqlPath, "utf8");
  await client.connect();
  await client.query(schema);
  console.log(`Schema aplicado com sucesso em ${isNeon ? "Neon" : "Postgres local"}.`);
} catch (error) {
  console.error("Falha ao aplicar schema:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
