import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { setTaskCompleted } from "@/lib/db/tasks";
import { ValidationError, parseBoolean } from "@/lib/db/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const raw = await context.params;
    const taskId = Number(raw.id);
    if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError("Tarefa inválida.");

    let completed = true;
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (body && typeof body === "object" && body.completed !== undefined) {
        completed = parseBoolean(body.completed, "Concluída");
      }
    } catch {
      // corpo ausente é aceito: POST simples marca como concluída
    }
    const task = await setTaskCompleted(profileId, taskId, completed);
    return jsonOk({ task });
  });
}
