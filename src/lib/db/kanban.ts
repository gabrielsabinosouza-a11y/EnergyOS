import pool from "../db";
import type { KanbanTask, KanbanStatus, KanbanCategory, KanbanPriority, KanbanLabel } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseEnum, parseProfileId, parseTitle } from "./validation";

const KANBAN_STATUSES: readonly KanbanStatus[] = ["todo", "doing", "done"];
const KANBAN_CATEGORIES: readonly KanbanCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];
const KANBAN_PRIORITIES: readonly KanbanPriority[] = ["low", "medium", "high"];

interface KanbanRow {
  id: string | number;
  profile_id: string;
  title: string;
  description: string | null;
  status: KanbanStatus;
  position: number;
  category: KanbanCategory;
  labels: string[] | null;
  due_date: Date | string | null;
  priority: KanbanPriority;
  assignee_id: string | null;
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
    labels: row.labels ?? [],
    dueDate: row.due_date ? (typeof row.due_date === "string" ? row.due_date : row.due_date.toISOString().slice(0, 10)) : undefined,
    priority: row.priority,
    assigneeId: row.assignee_id ?? undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString(),
  };
}

interface KanbanLabelRow {
  id: string | number;
  profile_id: string;
  name: string;
  color: string;
  created_at: Date | string;
}

function mapKanbanLabel(row: KanbanLabelRow): KanbanLabel {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    name: row.name,
    color: row.color,
  };
}

export async function listKanbanTasks(profileId: string): Promise<KanbanTask[]> {
  parseProfileId(profileId);
  const result = await pool.query<KanbanRow>(
    `select id, profile_id, title, description, status, position, category, labels, due_date, priority, assignee_id, created_at, updated_at
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
  labels?: string[];
  dueDate?: string;
  priority?: KanbanPriority;
  assigneeId?: string;
}

export async function createKanbanTask(profileId: string, input: CreateKanbanInput): Promise<KanbanTask> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const status = parseEnum(input.status ?? "todo", KANBAN_STATUSES, "Status");
  const category = parseEnum(input.category ?? "FOCO", KANBAN_CATEGORIES, "Categoria");
  const priority = parseEnum(input.priority ?? "medium", KANBAN_PRIORITIES, "Prioridade");

  const maxPos = await pool.query<{ max_pos: string | number | null }>(
    `select coalesce(max(position), -1) as max_pos from kanban_tasks where profile_id = $1 and status = $2`,
    [profileId, status],
  );
  const nextPos = Number(maxPos.rows[0]?.max_pos ?? -1) + 1;

  const result = await pool.query<KanbanRow>(
    `insert into kanban_tasks (profile_id, title, description, status, position, category, labels, due_date, priority, assignee_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, profile_id, title, description, status, position, category, labels, due_date, priority, assignee_id, created_at, updated_at`,
    [profileId, title, input.description ?? null, status, nextPos, category, input.labels ?? [], input.dueDate ?? null, priority, input.assigneeId ?? null],
  );
  return mapKanban(result.rows[0]);
}

export interface UpdateKanbanPatch {
  title?: string;
  description?: string | null;
  status?: KanbanStatus;
  category?: KanbanCategory;
  position?: number;
  labels?: string[];
  dueDate?: string | null;
  priority?: KanbanPriority;
  assigneeId?: string | null;
}

export async function updateKanbanTask(profileId: string, taskId: number, patch: UpdateKanbanPatch): Promise<KanbanTask> {
  parseProfileId(profileId);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");

  const updates: string[] = [];
  const values: (string | number | string[] | null)[] = [profileId, taskId];

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
  if (patch.labels !== undefined) {
    values.push(patch.labels);
    updates.push(`labels = $${values.length}`);
  }
  if (patch.dueDate !== undefined) {
    values.push(patch.dueDate);
    updates.push(`due_date = $${values.length}`);
  }
  if (patch.priority !== undefined) {
    values.push(parseEnum(patch.priority, KANBAN_PRIORITIES, "Prioridade"));
    updates.push(`priority = $${values.length}`);
  }
  if (patch.assigneeId !== undefined) {
    values.push(patch.assigneeId);
    updates.push(`assignee_id = $${values.length}`);
  }

  if (updates.length === 0) throw new ValidationError("Nenhum campo para atualizar.");
  updates.push(`updated_at = now()`);

  const result = await pool.query<KanbanRow>(
    `update kanban_tasks set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id, profile_id, title, description, status, position, category, labels, due_date, priority, assignee_id, created_at, updated_at`,
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

export interface MoveKanbanTaskInput {
  taskId: number;
  newStatus: KanbanStatus;
  newPosition: number;
}

export async function moveKanbanTask(
  profileId: string,
  input: MoveKanbanTaskInput
): Promise<KanbanTask> {
  parseProfileId(profileId);
  if (!Number.isInteger(input.taskId) || input.taskId <= 0) {
    throw new ValidationError("Tarefa inválida.");
  }
  const { taskId, newStatus, newPosition } = input;
  const validatedStatus = parseEnum(newStatus, KANBAN_STATUSES, "Status");
  const validatedPosition = Math.max(0, Math.floor(input.newPosition));

  // Start transaction
  const client = await pool.connect();
  try {
    // 1. Get the current task to find its old status and position
    const taskResult = await client.query<KanbanRow>(
      `select status, position from kanban_tasks where profile_id = $1 and id = $2`,
      [profileId, taskId]
    );
    if (!taskResult.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
    
    const oldStatus = taskResult.rows[0].status;
    const oldPosition = taskResult.rows[0].position;
    
    // If moving within the same column, we need to reorder positions
    if (oldStatus === validatedStatus) {
      // Update positions in the same column
      if (validatedPosition > oldPosition) {
        // Moving down: decrement positions between old and new
        await client.query(
          `update kanban_tasks set position = position - 1 
           where profile_id = $1 and status = $2 and position > $3 and position <= $4`,
          [profileId, oldStatus, oldPosition, validatedPosition]
        );
      } else if (validatedPosition < oldPosition) {
        // Moving up: increment positions between new and old
        await client.query(
          `update kanban_tasks set position = position + 1 
           where profile_id = $1 and status = $2 and position >= $3 and position < $4`,
          [profileId, oldStatus, validatedPosition, oldPosition]
        );
      }
    } else {
      // Moving between different columns
      // 1. Remove from old column - shift positions down
      await client.query(
        `update kanban_tasks set position = position - 1 
         where profile_id = $1 and status = $2 and position > $3`,
        [profileId, oldStatus, oldPosition]
      );
      
      // 2. Add to new column - shift positions up
      await client.query(
        `update kanban_tasks set position = position + 1 
         where profile_id = $1 and status = $2 and position >= $3`,
        [profileId, validatedStatus, validatedPosition]
      );
    }
    
    // 3. Update the moved task itself
    const result = await client.query<KanbanRow>(
      `update kanban_tasks set status = $1, position = $2, updated_at = now()
       where profile_id = $3 and id = $4
       returning id, profile_id, title, description, status, position, category, labels, due_date, priority, assignee_id, created_at, updated_at`,
      [validatedStatus, validatedPosition, profileId, taskId]
    );
    
    if (!result.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
    
    return mapKanban(result.rows[0]);
  } finally {
    client.release();
  }
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

// ========================================
// Label Management
// ========================================

export async function listKanbanLabels(profileId: string): Promise<KanbanLabel[]> {
  parseProfileId(profileId);
  const result = await pool.query<KanbanLabelRow>(
    `select id, profile_id, name, color, created_at from kanban_labels where profile_id = $1 order by name`,
    [profileId],
  );
  return result.rows.map(mapKanbanLabel);
}

export interface CreateKanbanLabelInput {
  name: string;
  color: string;
}

export async function createKanbanLabel(profileId: string, input: CreateKanbanLabelInput): Promise<KanbanLabel> {
  parseProfileId(profileId);
  if (!input.name.trim()) throw new ValidationError("Nome da etiqueta é obrigatório.");
  if (!input.color) throw new ValidationError("Cor é obrigatória.");

  const result = await pool.query<KanbanLabelRow>(
    `insert into kanban_labels (profile_id, name, color) values ($1, $2, $3)
     returning id, profile_id, name, color, created_at`,
    [profileId, input.name.trim(), input.color],
  );
  return mapKanbanLabel(result.rows[0]);
}

export async function deleteKanbanLabel(profileId: string, labelId: number): Promise<void> {
  parseProfileId(profileId);
  if (!Number.isInteger(labelId) || labelId <= 0) throw new ValidationError("Etiqueta inválida.");
  
  const result = await pool.query(
    `delete from kanban_labels where profile_id = $1 and id = $2`,
    [profileId, labelId],
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError("Etiqueta não encontrada.");
}
