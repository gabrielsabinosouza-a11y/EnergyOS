#!/usr/bin/env node
/**
 * Database migration runner.
 * Applies unapplied migrations in order and records them in schema_migrations table.
 * Idempotent: safe to run multiple times.
 *
 * Usage: npx ts-node scripts/db-migrate.ts
 */

import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

interface Migration {
  filename: string;
  content: string;
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    `select filename from schema_migrations order by applied_at`
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function getMigrationFiles(): Promise<Migration[]> {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((filename) => ({
    filename,
    content: fs.readFileSync(path.join(migrationsDir, filename), "utf-8"),
  }));
}

async function applyMigration(
  client: PoolClient,
  filename: string,
  content: string
): Promise<void> {
  console.log(`  Applying ${filename}...`);
  try {
    await client.query(content);
    await client.query(
      `insert into schema_migrations (filename) values ($1)`,
      [filename]
    );
    console.log(`  ✓ ${filename}`);
  } catch (error) {
    console.error(`  ✗ ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Ensuring schema_migrations table exists...");
    await ensureMigrationsTable(client);

    console.log("Reading applied migrations...");
    const applied = await getAppliedMigrations(client);
    console.log(`  ${applied.size} migrations already applied`);

    console.log("Reading migration files...");
    const migrations = await getMigrationFiles();
    console.log(`  ${migrations.length} migration files found`);

    const unapplied = migrations.filter((m) => !applied.has(m.filename));
    if (unapplied.length === 0) {
      console.log("\n✓ All migrations are up to date");
      return;
    }

    console.log(`\nApplying ${unapplied.length} unapplied migrations...\n`);
    for (const migration of unapplied) {
      await applyMigration(client, migration.filename, migration.content);
    }

    console.log(`\n✓ All migrations applied successfully`);
  } catch (error) {
    console.error("\nERROR:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
