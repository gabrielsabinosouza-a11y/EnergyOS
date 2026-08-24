import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { deleteTask, setTaskCompleted, updateTask } from "@/lib/db/tasks";
import { assertObject, parseBoolean, parseDate, parseEnum, parseNumber, parseProfileId, parseTitle } from "@/lib/db/validation";
import type { TaskCategory } from "@/types";

const TASK_CATEGORIES: readonly TaskCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

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
    if (body.category !== undefined) patch.category = parseEnum(body.category, TASK_CATEGORIES, "Categoria");
    if (body.dueDate !== undefined) patch.dueDate = parseDate(body.dueDate, "Data da tarefa");
    if (body.completed !== undefined) {
      const task = await setTaskCompleted(profileId, taskId, parseBoolean(body.completed, "Concluída"));
      return jsonOk({ task });
    }
    return jsonOk({ task: await updateTask(profileId, taskId, patch) });
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
