// Migration to add missing timer columns to focus_rooms table
import pg from 'pg';
import { readFileSync } from 'fs';

// Load environment variables
const envLines = [];
try {
  envLines.push(...readFileSync('.env.local', 'utf8').split('\n'));
} catch {}
try {
  envLines.push(...readFileSync('.env', 'utf8').split('\n'));
} catch {}

let connectionString = process.env.DATABASE_URL;
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    connectionString = line.split('=', 2)[1];
    break;
  }
}

if (!connectionString) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

const migrations = [
  // Add ends_at column
  {
    name: 'add_ends_at_column',
    sql: `ALTER TABLE focus_rooms ADD COLUMN IF NOT EXISTS ends_at timestamptz;`
  },
  // Add paused_at column
  {
    name: 'add_paused_at_column',
    sql: `ALTER TABLE focus_rooms ADD COLUMN IF NOT EXISTS paused_at timestamptz;`
  },
  // Add remaining_seconds column
  {
    name: 'add_remaining_seconds_column',
    sql: `ALTER TABLE focus_rooms ADD COLUMN IF NOT EXISTS remaining_seconds integer NOT NULL DEFAULT 0;`
  }
];

async function runMigration() {
  console.log('Running migration to add timer columns...\n');
  
  for (const migration of migrations) {
    console.log(`- ${migration.name}...`);
    try {
      await pool.query(migration.sql);
      console.log(`  ✓ Success`);
    } catch (error) {
      if (error.code === '42710') { // duplicate_object
        console.log(`  - Already exists, skipping`);
      } else {
        console.error(`  ✗ Error:`, error.message);
        throw error;
      }
    }
  }
  
  console.log('\n✓ Migration completed successfully!');
  
  // Verify
  console.log('\nVerifying columns...');
  const result = await pool.query(
    `SELECT column_name, is_nullable, column_default 
     FROM information_schema.columns 
     WHERE table_name = 'focus_rooms' AND column_name IN ('ends_at', 'paused_at', 'remaining_seconds')
     ORDER BY ordinal_position`
  );
  
  console.log('Columns found:', result.rows.map(r => r.column_name).join(', '));
}

runMigration()
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(() => pool.end());