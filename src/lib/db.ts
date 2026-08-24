import { Pool } from "pg";
import type { Goal, Habit } from "@/types";

export interface HabitWithCompletion extends Habit {
  completedToday?: boolean;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada. Copie .env.example para .env.local.");
}

declare global {
  var energyosPgPool: Pool | undefined;
}

const pool =
  globalThis.energyosPgPool ??
  new Pool({
    connectionString,
    ssl: /neon\.tech/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.energyosPgPool = pool;
}

export default pool;

export interface DbGoalRow {
  id: string | number;
  profile_id: string;
  title: string;
  category: Goal["category"];
  target_value: string | number;
  current_value: string | number;
  frequency: Goal["frequency"];
}

export interface DbHabitRow {
  id: string | number;
  goal_id: string | number;
  title: string;
  frequency: Habit["frequency"];
  active: boolean;
  completed_today?: boolean;
}

export function mapGoalRow(row: DbGoalRow): Goal {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    category: row.category,
    targetValue: Number(row.target_value),
    currentValue: Number(row.current_value),
    frequency: row.frequency,
  };
}

export function mapHabitRow(row: DbHabitRow): HabitWithCompletion {
  return {
    id: Number(row.id),
    goalId: Number(row.goal_id),
    title: row.title,
    frequency: row.frequency,
    active: row.active,
    completedToday: Boolean(row.completed_today),
  };
}
