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

    const patch: Parameters<typeof updateTask>[2] = {};
    if (body.title !== undefined) patch.title = parseTitle(body.title);
    if (body.categoryId !== undefined) patch.categoryId = parseNumber(body.categoryId, "Categoria", { integer: true, min: 1 });
    if (body.dueDate !== undefined) patch.dueDate = parseDate(body.dueDate, "Data da tarefa");
    if (body.completed !== undefined) {
      const task = await setTaskCompleted(profileId, taskId, parseBoolean(body.completed, "Concluída"));
      return jsonOk({ task });
    }
    const updatedTask = await updateTask(profileId, taskId, patch);
    return jsonOk({ task: updatedTask });
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const taskId = await resolveTaskId(context);
    parseProfileId(profileId);

    await deleteTask(profileId, taskId);
    return jsonOk({ ok: true });
  });
}
