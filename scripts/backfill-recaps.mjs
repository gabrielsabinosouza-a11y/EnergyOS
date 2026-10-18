#!/usr/bin/env node
/**
 * Backfill script for recap data.
 * Run this after deploying the recap schema fixes to rebuild
 * August and September 2026 (and any other months) from raw data.
 */

const { getRecaps, generateRecap } = await import("../src/lib/db/recap.js");

// Load environment
import { readFileSync } from 'node:fs';
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    process.env[key] = val;
  }
}

async function main() {
  console.log('=== Backfill Recap Data ===\n');
  
  const PROFILE_IDS = [
    '0e719da0-f486-469c-b27f-9b3b5612fb50', // Test profile
    // TODO: Add other profile IDs as needed
  ];
  
  // Months to backfill (in YYYY-MM format)
  const MONTHS_TO_BACKFILL = [
    '2026-08',  // August 2026
    '2026-09',  // September 2026
  ];
  
  for (const profileId of PROFILE_IDS) {
    console.log(`\nProcessing profile: ${profileId}`);
    
    for (const month of MONTHS_TO_BACKFILL) {
      const monthStart = `${month}-01`;
      console.log(`  Backfilling ${month}...`);
      
      try {
        const recap = await generateRecap(profileId, monthStart);
        console.log(`    ✓ Generated recap for ${month}:`);
        console.log(`      - Focus: ${recap.totalFocusMinutes} min`);
        console.log(`      - XP: ${recap.totalXp}`);
        console.log(`      - Status: ${recap.status}`);
        console.log(`      - Finalized: ${!!recap.finalizedAt}`);
      } catch (e) {
        console.log(`    ✗ Error: ${e.message}`);
      }
    }
  }
  
  // Final verification
  console.log('\n=== Verification ===');
  for (const profileId of PROFILE_IDS) {
    console.log(`\nRecaps for ${profileId}:`);
    const recaps = await getRecaps(profileId);
    for (const r of recaps.recaps) {
      console.log(`  ${r.recapMonth}: ${r.totalXp} XP, ${r.totalFocusMinutes} min, ${r.status}`);
    }
  }
  
  console.log('\n=== Done ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});