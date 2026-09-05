import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { todayIso } from "@/lib/db/dates";
import {
  toggleDailyTask,
  deactivateDailyTask,
  updateDailyTaskTitle,
} from "@/lib/db/daily-tasks";
import { assertObject, parseTitle, ValidationError } from "@/lib/db/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const taskId = Number(id);
    const body = assertObject(await readJsonBody(request));

    // Title present -> editing the task name; otherwise treat as completion toggle.
    if (body.title !== undefined) {
      const title = parseTitle(body.title, "Nome da tarefa");
      if (title.length > 120) {
        throw new ValidationError("Tarefa muito longa (máx. 120 caracteres).");
      }
      return jsonOk({ task: await updateDailyTaskTitle(profileId, taskId, title) });
    }

    const completed = Boolean(body.completed);

    const result = await toggleDailyTask(profileId, taskId, completed, todayIso());

    const parts: string[] = [];
    if (result.xpAwarded > 0) parts.push(`+${result.xpAwarded} XP`);
    if (result.coinsAwarded > 0) parts.push(`+${result.coinsAwarded} moedas`);

    return jsonOk({
      task: result.task,
      xpAwarded: result.xpAwarded,
      coinsAwarded: result.coinsAwarded,
      message: parts.length > 0 ? parts.join(" · ") : undefined,
    });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    // Soft-archive: keeps the task row and its completion history, hides it
    // from the daily checklist from now on.
    await deactivateDailyTask(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}
