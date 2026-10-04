import { readFileSync } from "node:fs";
import { Pool } from "pg";
import type { Goal, Habit } from "@/types";

export interface HabitWithCompletion extends Habit {
  completedToday?: boolean;
}

const connectionString = process.env.DATABASE_URL;

console.log('[db] Database connection string configured:', connectionString ? 'Yes' : 'No');

declare global {
  var energyosPgPool: Pool | undefined;
}

const isNeon = /neon\.tech/.test(connectionString ?? '');
// TLS policy: in production (or DATABASE_SSL_STRICT=true) the server
// certificate is fully verified. Neon's AWS/GCP endpoints present
// publicly-trusted certificates (Amazon Trust Services / Google Trust
// Services), so Node's built-in root store validates them — verified
// empirically against the production endpoint with rejectUnauthorized: true.
// Optionally pin an explicit CA bundle via DATABASE_SSL_CA_PATH. Development
// keeps the lenient mode so local/self-signed Postgres still works.
const sslStrict = process.env.NODE_ENV === "production" || process.env.DATABASE_SSL_STRICT === "true";
const caPath = process.env.DATABASE_SSL_CA_PATH;

const pool =
  globalThis.energyosPgPool ??
  new Pool({
    connectionString: connectionString ?? 'postgres://localhost:5432/energyos',
    ssl: isNeon
      ? sslStrict
        ? { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath) } : {}) }
        : { rejectUnauthorized: false }
      : undefined,
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

/** Colunas de goal + categoria resolvida (join com categories). Compartilhado
 *  entre `db/goals.ts` (CRUD) e `db/goal-logs.ts` (check-ins por período). */
export const GOAL_SELECT = `
  select g.id, g.profile_id, g.title, g.target_value, g.current_value, g.frequency, g.created_at,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from goals g
  join categories c on c.id = g.category_id`;

export interface GoalWithProgress extends Goal {
  progressPercentage: number;
}

/** Progresso de meta em % (0–100), sempre derivado de valores do servidor. */
export function goalProgressPercentage(goal: Goal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
}

/**
 * Monta o GoalWithProgress. Desde o modelo baseado em logs, `currentValue` é
 * SEMPRE o somatório do período atual (nunca a coluna legada `current_value`,
 * que é ignorada) — `derivedCurrentValue` sobrescreve o valor da linha.
 */
export function withGoalProgress(goal: Goal, derivedCurrentValue?: number): GoalWithProgress {
  const normalized = derivedCurrentValue === undefined ? goal : { ...goal, currentValue: derivedCurrentValue };
  return { ...normalized, progressPercentage: goalProgressPercentage(normalized) };
}

