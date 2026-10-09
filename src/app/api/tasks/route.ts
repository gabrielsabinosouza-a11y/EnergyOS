import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { computeProgress, createTask, listTasksByDate } from "@/lib/db/tasks";
import { todayIso } from "@/lib/db/dates";
import { assertObject, parseDate, parseNumber, parseTitle } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const date = parseDate(request.nextUrl.searchParams.get("date"), "Data", todayIso());
    const tasks = await listTasksByDate(profileId, date);
    return jsonOk({ date, tasks, progress: computeProgress(tasks) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = assertObject(await readJsonBody(request));

    const task = await createTask(
      profileId,
      {
        title: parseTitle(body.title),
        categoryId: body.categoryId === undefined ? undefined : parseNumber(body.categoryId, "Categoria", { integer: true, min: 1 }),
        dueDate: body.dueDate === undefined ? undefined : parseDate(body.dueDate, "Data da tarefa"),
      },
      todayIso(),
    );

    return jsonOk({ task }, 201);
  });
}
