import pool from "../db";
import type { KanbanTask, KanbanStatus, KanbanPriority, KanbanLabel } from "@/types";
import { NotFoundError } from "../errors";
import { ValidationError, parseEnum, parseProfileId, parseTitle } from "./validation";
import { assertCategoryForProfile, resolveDefaultCategoryId } from "./categories";
import { recordMissionProgress } from "./daily-quests";
import { awardKanbanXP } from "./xp";
import { addCoins } from "./settings";
import { KANBAN_XP_BY_PRIORITY, KANBAN_DONE_COINS } from "../daily-limits";

const KANBAN_STATUSES: readonly KanbanStatus[] = ["todo", "doing", "done"];
const KANBAN_PRIORITIES: readonly KanbanPriority[] = ["low", "medium", "high"];

/** Colunas de kanban_task + categoria resolvida (join com categories). */
const KANBAN_SELECT = `
  select k.id, k.profile_id, k.title, k.description, k.status, k.position, k.labels,
         k.due_date, k.priority, k.assignee_id, k.created_at, k.updated_at,
         c.id as category_id, c.user_id as category_user_id, c.name as category_name,
         c.color as category_color, c.icon as category_icon, c.is_custom as category_is_custom,
         c.created_at as category_created_at
  from kanban_tasks k
  join categories c on c.id = k.category_id`;

interface KanbanRow {
  id: string | number;
  profile_id: string;
  title: string;
  description: string | null;
  status: KanbanStatus;
  position: number;
  labels: string[] | null;
  due_date: Date | string | null;
  priority: KanbanPriority;
  assignee_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  category_id: string | number;
  category_user_id: string | null;
  category_name: string;
  category_color: string;
  category_icon: string | null;
  category_is_custom: boolean;
  category_created_at: Date | string;
}

function mapKanban(row: KanbanRow): KanbanTask {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    position: row.position,
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
    `${KANBAN_SELECT}
     where k.profile_id = $1
     order by k.status, k.position, k.id`,
    [profileId],
  );
  return result.rows.map(mapKanban);
}

export interface CreateKanbanInput {
  title: string;
  description?: string;
  status?: KanbanStatus;
  categoryId?: number;
  labels?: string[];
  dueDate?: string;
  priority?: KanbanPriority;
  assigneeId?: string;
}

export async function createKanbanTask(profileId: string, input: CreateKanbanInput): Promise<KanbanTask> {
  parseProfileId(profileId);
  const title = parseTitle(input.title);
  const status = parseEnum(input.status ?? "todo", KANBAN_STATUSES, "Status");
  const priority = parseEnum(input.priority ?? "medium", KANBAN_PRIORITIES, "Prioridade");
  const categoryId = input.categoryId !== undefined
    ? await assertCategoryForProfile(profileId, input.categoryId)
    : await resolveDefaultCategoryId();

  const maxPos = await pool.query<{ max_pos: string | number | null }>(
    `select coalesce(max(position), -1) as max_pos from kanban_tasks where profile_id = $1 and status = $2`,
    [profileId, status],
  );
  const nextPos = Number(maxPos.rows[0]?.max_pos ?? -1) + 1;

  const inserted = await pool.query<{ id: string | number }>(
    `insert into kanban_tasks (profile_id, title, description, status, position, category_id, labels, due_date, priority, assignee_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id`,
    [profileId, title, input.description ?? null, status, nextPos, categoryId, input.labels ?? [], input.dueDate ?? null, priority, input.assigneeId ?? null],
  );
  const result = await pool.query<KanbanRow>(`${KANBAN_SELECT} where k.id = $1`, [inserted.rows[0].id]);
  return mapKanban(result.rows[0]);
}

export interface UpdateKanbanPatch {
  title?: string;
  description?: string | null;
  status?: KanbanStatus;
  categoryId?: number;
  position?: number;
  labels?: string[];
  dueDate?: string | null;
  priority?: KanbanPriority;
  assigneeId?: string | null;
}

export async function updateKanbanTask(profileId: string, taskId: number, patch: UpdateKanbanPatch): Promise<KanbanTask> {
  parseProfileId(profileId);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");

  const statusUpdate = patch.status !== undefined
    ? parseEnum(patch.status, KANBAN_STATUSES, "Status")
    : undefined;

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
  if (statusUpdate !== undefined) {
    values.push(statusUpdate);
    updates.push(`status = $${values.length}`);
  }
  if (patch.categoryId !== undefined) {
    const categoryId = await assertCategoryForProfile(profileId, patch.categoryId);
    values.push(categoryId);
    updates.push(`category_id = $${values.length}`);
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

  const wasDone = await pool.query<{ status: string }>(
    `select status from kanban_tasks where profile_id = $1 and id = $2`,
    [profileId, taskId],
  );
  if (!wasDone.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
  const becomingDone = statusUpdate === "done" && wasDone.rows[0].status !== "done";

  const updated = await pool.query<{ id: string | number }>(
    `update kanban_tasks set ${updates.join(", ")}
     where profile_id = $1 and id = $2
     returning id`,
    values,
  );
  if (!updated.rows[0]) throw new NotFoundError("Tarefa não encontrada.");
  const result = await pool.query<KanbanRow>(`${KANBAN_SELECT} where k.id = $1`, [updated.rows[0].id]);

  // Completing via a status update also counts toward daily missions.
  if (becomingDone) {
    await recordMissionProgress(profileId, "TASKS_COMPLETED", { incrementBy: 1 });
  }

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
    const updated = await client.query<{ id: string | number }>(
      `update kanban_tasks set status = $1, position = $2, updated_at = now()
       where profile_id = $3 and id = $4
       returning id`,
      [validatedStatus, validatedPosition, profileId, taskId]
    );
    
    if (!updated.rows[0]) throw new NotFoundError("Tarefa não encontrada.");

    const result = await client.query<KanbanRow>(`${KANBAN_SELECT} where k.id = $1`, [updated.rows[0].id]);

      const becomingDone = validatedStatus === "done" && oldStatus !== "done";

    if (becomingDone) {
      await recordMissionProgress(profileId, "TASKS_COMPLETED", { incrementBy: 1, client });
    }

    const task = mapKanban(result.rows[0]);
    return task;
  } finally {
    client.release();
  }
}

/** Awards XP (priority-scaled) + coins when a kanban task first enters "done". Returns amounts credited (0 if already awarded). */
export async function awardKanbanCompletion(
  profileId: string,
  taskId: number,
): Promise<{ xpAwarded: number; coinsAwarded: number }> {
  // Look up priority so XP scales correctly
  const taskRow = await pool.query<{ priority: string }>(
    `select priority from kanban_tasks where id = $1`,
    [taskId],
  );
  const priority = taskRow.rows[0]?.priority ?? "medium";
  const baseXP = KANBAN_XP_BY_PRIORITY[priority] ?? KANBAN_XP_BY_PRIORITY.medium;

  const xpAwarded = await awardKanbanXP(profileId, taskId, baseXP);
  let coinsAwarded = 0;
  if (xpAwarded > 0) {
    await addCoins(profileId, KANBAN_DONE_COINS);
    coinsAwarded = KANBAN_DONE_COINS;
  }
  return { xpAwarded, coinsAwarded };
}

export async function promoteTaskToKanban(profileId: string, taskId: number): Promise<KanbanTask> {
  parseProfileId(profileId);
  if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");

  const taskResult = await pool.query<{ id: string | number; title: string; category_id: string | number }>(
    `select id, title, category_id from tasks where profile_id = $1 and id = $2`,
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
    categoryId: Number(task.category_id),
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
