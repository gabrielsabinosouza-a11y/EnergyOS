import { Pool } from "pg";
import type { Goal, Habit } from "@/types";

export interface HabitWithCompletion extends Habit {
  completedToday?: boolean;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada. Copie .env.example para .env.local.");
}

console.log('[db] Database connection string configured:', connectionString ? 'Yes' : 'No');

declare global {
  var energyosPgPool: Pool | undefined;
}

const pool =
  globalThis.energyosPgPool ??
  new Pool({
    connectionString,
    ssl: /neon\.tech/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

pool.on('connect', () => {
  // Only log in development to reduce noise
  if (process.env.NODE_ENV !== 'production') {
    console.log('[db] New client connected');
  }
});

console.log('[db] Database pool created');

if (process.env.NODE_ENV !== "production") {
  globalThis.energyosPgPool = pool;
}

export default pool;

export interface DbGoalRow {
  id: string | number;
  profile_id: string;
  title: string;
  target_value: string | number;
  current_value: string | number;
  frequency: Goal["frequency"];
  category_id: string | number;
  category_user_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  category_is_custom: boolean;
  category_created_at: Date | string;
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
    categoryId: Number(row.category_id),
    category: {
      id: Number(row.category_id),
      userId: row.category_user_id,
      name: row.category_name,
      color: row.category_color,
      icon: row.category_icon,
      isCustom: row.category_is_custom,
      createdAt: typeof row.category_created_at === "string"
        ? row.category_created_at
        : row.category_created_at.toISOString(),
    },
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
