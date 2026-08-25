import pool from "../db";
import type { KanbanTask, KanbanStatus, KanbanCategory } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseEnum, parseProfileId, parseTitle } from "./validation";

const KANBAN_STATUSES: readonly KanbanStatus[] = ["todo", "doing", "done"];
const KANBAN_CATEGORIES: readonly KanbanCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

interface KanbanRow {
  id: string | number;
  profile_id: string;
  title: string;
  description: string | null;
  status: KanbanStatus;
  position: number;
  category: KanbanCategory;
  created_at: Date | string;
  updated_at: Date | string;
}

function mapKanban(row: KanbanRow): KanbanTask {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    position: row.position,
    category: row.category,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString(),
  };
}

export async function listKanbanTasks(profileId: string): Promise<KanbanTask[]> {
  parseProfileId(profileId);
  const result = await pool.query<KanbanRow>(
    `select id, profile_id, title, description, status, position, category, created_at, updated_at
     from kanban_tasks where profile_id = $1
     order by status, position, id`,
    [profileId],
  );
  return result.rows.map(mapKanban);
}

export interface CreateKanbanInput {
  title: string;
  description?: string;
  status?: KanbanStatus;
  category?: KanbanCategory;
}

export async function createKanbanTask(profileId: string, input: CreateKanbanInput): Promise<KanbanTask> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const status = parseEnum(input.status ?? "todo", KANBAN_STATUSES, "Status");
  const category = parseEnum(input.category ?? "FOCO", KANBAN_CATEGORIES, "Categoria");

  const maxPos = await pool.query<{ max_pos: string | number | null }>(
    `select coalesce(max(position), -1) as max_pos from kanban_tasks where profile_id = $1 and status = $2`,
    [profileId, status],
  );
  const nextPos = Number(maxPos.rows[0]?.max_pos ?? -1) + 1;

  const result = await pool.query<KanbanRow>(
    `insert into kanban_tasks (profile_id, title, description, status, position, category)
     values ($1, $2, $3, $4, $5, $6)
     returning id, profile_id, title, description, status, position, category, created_at, updated_at`,
    [profileId, title, input.description ?? null, status, nextPos, category],
  );
  return mapKanban(result.rows[0]);
}

export interface UpdateKanbanPatch {
  title?: string;
  description?: string | null;
  status?: KanbanStatus;
  category?: KanbanCategory;
  position?: number;
}

export async function updateKanbanTask(profileId: string, taskId: number, patch: UpdateKanbanPatch): Promise<KanbanTask> {
  parseProfileId(profileId);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");

  const updates: string[] = [];
  const values: (string | number | null)[] = [profileId, taskId];

  if (patch.title !== undefined) {
    values.push(parseTitle(patch.title));
    updates.push(`title = $${values.length}`);
  }
  if (patch.description !== undefined) {
    values.push(patch.description);
    updates.push(`description = $${values.length}`);
  }
  if (patch.status !== undefined) {
    values.push(parseEnum(patch.status, KANBAN_STATUSES, "Status"));
    updates.push(`status = $${values.length}`);
  }
  if (patch.category !== undefined) {
    values.push(parseEnum(patch.category, KANBAN_CATEGORIES, "Categoria"));
    updates.push(`category = $${values.length}`);
  }
  if (patch.position !== undefined) {
    values.push(patch.position);
    updates.push(`position = $${values.length}`);
  }

  if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");
  updates.push(`updated_at = now()`);

  const result = await pool.query<KanbanRow>(
    `update kanban_tasks set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id, profile_id, title, description, status, position, category, created_at, updated_at`,
    values,
  );
  if (!result.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
  return mapKanban(result.rows[0]);
}

export async function deleteKanbanTask(profileId: string, taskId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");
  const result = await pool.query(`delete from kanban_tasks where profile_id = $1 and id = $2`, [profileId, taskId]);
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Tarefa não encontrada.");
}

export async function promoteTaskToKanban(profileId: string, taskId: number): Promise<KanbanTask> {
  parseProfileId(profileId);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");

  const taskResult = await pool.query<{ id: string | number; title: string; category: string }>(
    `select id, title, category from tasks where profile_id = $1 and id = $2`,
    [profileId, taskId],
  );
  if (!taskResult.rows[0]) throw new NotFoundError("Tarefa não encontrada.");

  const task = taskResult.rows[0];

  const existing = await pool.query(
    `select 1 from kanban_tasks where profile_id = $1 and title = $2 and status != 'done'`,
    [profileId, task.title],
  );
  if (existing.rows[0]) throw new ValidationError("Esta tarefa já foi promovida ao Kanban.");

  const kanbanTask = await createKanbanTask(profileId, {
    title: task.title,
    category: task.category as KanbanCategory,
    status: "todo",
  });

  await pool.query(
    `update tasks set completed_at = now() where profile_id = $1 and id = $2 and completed_at is null`,
    [profileId, taskId],
  );

  return kanbanTask;
}
