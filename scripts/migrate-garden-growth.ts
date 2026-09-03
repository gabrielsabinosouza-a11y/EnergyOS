/**
 * Migration script to add growth_stage and status columns to garden_entries table
 * Run this with: npx tsx scripts/migrate-garden-growth.ts
 */

import pool from "../src/lib/db";

async function migrate() {
  console.log("Starting garden growth migration...");
  
  try {
    // Add growth_stage column
    await pool.query(`
      ALTER TABLE garden_entries 
      ADD COLUMN IF NOT EXISTS growth_stage TEXT NOT NULL DEFAULT 'sprout' 
      CHECK (growth_stage IN ('sprout', 'young', 'mature'))
    `);
    console.log("✓ Added growth_stage column");
    
    // Add status column
    await pool.query(`
      ALTER TABLE garden_entries 
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'alive' 
      CHECK (status IN ('growing', 'alive', 'withered'))
    `);
    console.log("✓ Added status column");
    
    // Update existing entries to have appropriate values
    await pool.query(`
      UPDATE garden_entries 
      SET 
        growth_stage = CASE 
          WHEN duration_minutes >= 60 THEN 'mature'
          WHEN duration_minutes >= 30 THEN 'young'
          ELSE 'sprout'
        END,
        status = 'alive'
      WHERE status IS NULL OR status = ''
    `);
    console.log("✓ Updated existing entries with appropriate growth stages and status");
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();