import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { computeProgress, createTask, listTasksByDate } from "@/lib/db/tasks";
import { todayIso } from "@/lib/db/dates";
import { assertObject, parseDate, parseEnum, parseTitle } from "@/lib/db/validation";
import type { TaskCategory } from "@/types";

const TASK_CATEGORIES: readonly TaskCategory[] = ["FOCO", "CORPO", "MENTE", "ORDEM", "ENERGIA"];

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const date = parseDate(request.nextUrl.searchParams.get("date"), "Data", todayIso());
    const tasks = await listTasksByDate(profileId, date);
    return jsonOk({ date, tasks, progress: computeProgress(tasks) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = assertObject(await readJsonBody(request));
    
    console.log('[tasks POST] Attempting to create task for profile:', profileId);
    console.log('[tasks POST] Request body:', body);
    
    const task = await createTask(
      profileId,
      {
        title: parseTitle(body.title),
        category: parseEnum(body.category, TASK_CATEGORIES, "Categoria"),
        dueDate: body.dueDate === undefined ? undefined : parseDate(body.dueDate, "Data da tarefa"),
      },
      todayIso(),
    );
    
    console.log('[tasks POST] Task created successfully:', task);
    return jsonOk({ task }, 201);
  });
}
