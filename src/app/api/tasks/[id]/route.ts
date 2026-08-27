import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { deleteTask, setTaskCompleted, updateTask } from "@/lib/db/tasks";
import { assertObject, parseBoolean, parseDate, parseNumber, parseProfileId, parseTitle } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveTaskId(context: RouteContext): Promise<number> {
  const { id } = await context.params;
  return parseNumber(id, "Identificador da tarefa", { integer: true, min: 1 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const taskId = await resolveTaskId(context);
    const body = assertObject(await readJsonBody(request));

    console.log('[tasks PATCH] Attempting to update task:', taskId, 'for profile:', profileId);
    console.log('[tasks PATCH] Request body:', body);

    const patch: Parameters<typeof updateTask>[2] = {};
    if (body.title !== undefined) patch.title = parseTitle(body.title);
    if (body.categoryId !== undefined) patch.categoryId = parseNumber(body.categoryId, "Categoria", { integer: true, min: 1 });
    if (body.dueDate !== undefined) patch.dueDate = parseDate(body.dueDate, "Data da tarefa");
    if (body.completed !== undefined) {
      const task = await setTaskCompleted(profileId, taskId, parseBoolean(body.completed, "Concluída"));
      console.log('[tasks PATCH] Task completion updated successfully:', task);
      return jsonOk({ task });
    }
    const updatedTask = await updateTask(profileId, taskId, patch);
    console.log('[tasks PATCH] Task updated successfully:', updatedTask);
    return jsonOk({ task: updatedTask });
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const taskId = await resolveTaskId(context);
    parseProfileId(profileId);
    
    console.log('[tasks DELETE] Attempting to delete task:', taskId, 'for profile:', profileId);
    
    await deleteTask(profileId, taskId);
    
    console.log('[tasks DELETE] Task deleted successfully');
    return jsonOk({ ok: true });
  });
}
