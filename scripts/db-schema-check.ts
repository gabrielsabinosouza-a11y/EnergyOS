#!/usr/bin/env node
/**
 * Read-only schema drift detector.
 * Connects to DATABASE_URL, reads information_schema, and compares with expected schema.
 * Never writes to the database. Never prints the connection string.
 *
 * Usage: npx ts-node scripts/db-schema-check.ts
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableInfo {
  table_name: string;
}

async function getActualSchema(): Promise<{
  tables: Set<string>;
  columns: Map<string, ColumnInfo[]>;
}> {
  const tablesResult = await pool.query<TableInfo>(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const tables = new Set(tablesResult.rows.map((r) => r.table_name));

  const columnsResult = await pool.query<ColumnInfo>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  );

  const columns = new Map<string, ColumnInfo[]>();
  for (const col of columnsResult.rows) {
    if (!columns.has(col.table_name)) {
      columns.set(col.table_name, []);
    }
    columns.get(col.table_name)!.push(col);
  }

  return { tables, columns };
}

async function main() {
  try {
    console.log("Connecting to database...");
    const { tables, columns } = await getActualSchema();

    console.log("\n=== SCHEMA DRIFT REPORT ===\n");

    // Expected tables and columns (from src/db-schema.sql analysis)
    const expectedTables = new Set([
      "profiles",
      "categories",
      "daily_checkins",
      "tasks",
      "goals",
      "habits",
      "user_settings",
      "habit_completions",
      "insights",
      "kanban_tasks",
      "kanban_labels",
      "focus_rooms",
      "room_participants",
      "room_join_requests",
      "league_groups",
      "league_group_members",
      "league_weekly_results",
      "coin_transactions",
      "weekly_plans",
      "weekly_plan_series",
      "weekly_plan_occurrences",
      "focus_sessions",
      "garden_entries",
      "xp_ledger",
      "user_xp",
      "friendships",
      "groups",
      "group_members",
      "group_focus_room_presence",
      "group_invites",
      "group_focus_contributions",
      "group_messages",
      "group_reads",
      "direct_messages",
      "dm_reads",
      "message_reactions",
      "pinned_messages",
      "group_activity_milestones",
      "group_milestone_claims",
      "group_weekly_quests",
      "group_weekly_quest_claims",
      "group_achievements",
      "group_achievement_claims",
      "league_standings",
      "league_entries",
      "achievements",
      "user_achievement_progress",
      "streak_achievement_tier_migrations",
      "achievement_progress_events",
      "achievement_rewards",
      "focus_session_events",
      "daily_quests",
      "user_quest_progress",
      "daily_mission_claims",
      "profile_daily_tasks",
      "daily_task_log",
      "user_daily_tasks",
      "avatar_decorations",
      "user_decorations",
      "streak_shield_designs",
      "user_streak_shield_designs",
      "streak_shield_usage",
      "streak_day_log",
      "user_potions",
      "xp_boost_purchase_requests",
      "active_xp_boost",
      "monthly_recaps",
      "monthly_recap_history",
      "push_subscriptions",
      "reminder_deliveries",
      "calendar_connections",
      "external_events",
      "planner_items",
      "planner_completions",
    ]);

    // Critical columns that must exist
    const expectedColumns: Record<string, Set<string>> = {
      focus_sessions: new Set([
        "id",
        "profile_id",
        "duration_minutes",
        "started_at",
        "ended_at",
        "paused_at",
        "away_started_at",
        "end_reason",
      ]),
      league_groups: new Set(["id", "tier", "week_start_date", "reset_at"]),
      profiles: new Set(["id", "times_top_1_global", "last_top_1_global_week"]),
      weekly_plan_series: new Set(["id", "reminder_offset_min"]),
      xp_boost_purchase_requests: new Set([
        "profile_id",
        "idempotency_key",
        "requested_quantity",
      ]),
      achievements: new Set(["id", "title", "description", "category"]),
    };

    let hasErrors = false;

    // Check for missing tables
    console.log("Missing tables:");
    let missingTableCount = 0;
    for (const table of expectedTables) {
      if (!tables.has(table)) {
        console.log(`  ✗ ${table}`);
        missingTableCount++;
        hasErrors = true;
      }
    }
    if (missingTableCount === 0) {
      console.log("  ✓ All expected tables exist");
    }

    // Check for missing columns
    console.log("\nMissing columns:");
    let missingColumnCount = 0;
    for (const [table, expectedCols] of Object.entries(expectedColumns)) {
      const actualCols = columns.get(table);
      if (!actualCols) {
        console.log(`  ✗ Table ${table} does not exist`);
        missingColumnCount++;
        hasErrors = true;
        continue;
      }
      const actualColNames = new Set(actualCols.map((c) => c.column_name));
      for (const col of expectedCols) {
        if (!actualColNames.has(col)) {
          console.log(`  ✗ ${table}.${col}`);
          missingColumnCount++;
          hasErrors = true;
        }
      }
    }
    if (missingColumnCount === 0) {
      console.log("  ✓ All critical columns exist");
    }

    // Check for type mismatches
    console.log("\nType mismatches:");
    const typeChecks: Record<string, Record<string, string>> = {
      focus_sessions: {
        paused_at: "timestamp with time zone",
        away_started_at: "timestamp with time zone",
        end_reason: "text",
      },
      league_groups: {
        reset_at: "timestamp with time zone",
      },
      profiles: {
        times_top_1_global: "integer",
        last_top_1_global_week: "date",
      },
    };

    let typeMismatchCount = 0;
    for (const [table, colTypes] of Object.entries(typeChecks)) {
      const actualCols = columns.get(table);
      if (!actualCols) continue;
      const actualColMap = new Map(actualCols.map((c) => [c.column_name, c.data_type]));
      for (const [col, expectedType] of Object.entries(colTypes)) {
        const actualType = actualColMap.get(col);
        if (actualType && actualType !== expectedType) {
          console.log(`  ✗ ${table}.${col}: expected ${expectedType}, got ${actualType}`);
          typeMismatchCount++;
          hasErrors = true;
        }
      }
    }
    if (typeMismatchCount === 0) {
      console.log("  ✓ All column types match");
    }

    console.log("\n=== SUMMARY ===");
    if (!hasErrors) {
      console.log("✓ Schema is up to date");
      process.exit(0);
    } else {
      console.log("✗ Schema drift detected");
      process.exit(1);
    }
  } catch (error) {
    console.error("ERROR:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
