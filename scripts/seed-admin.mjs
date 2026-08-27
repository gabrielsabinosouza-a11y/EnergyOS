/**
 * One-time migration script to promote pciskolargx@gmail.com to admin.
 * Run: npm run db:seed-admin
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const ADMIN_EMAIL = "pciskolargx@gmail.com";

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

const connectionString = await resolveDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL não definida. Use: DATABASE_URL=... npm run db:seed-admin");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

try {
  const result = await pool.query(
    `update profiles set role = 'admin' where email = $1 returning id, display_name, email, role`,
    [ADMIN_EMAIL],
  );

  if (result.rows.length === 0) {
    console.log(`Nenhum perfil encontrado com email ${ADMIN_EMAIL}`);
  } else {
    console.log("Promovido a admin:", result.rows[0]);
  }
} catch (error) {
  console.error("Falha na migração:", error);
  process.exit(1);
} finally {
  await pool.end();
}
