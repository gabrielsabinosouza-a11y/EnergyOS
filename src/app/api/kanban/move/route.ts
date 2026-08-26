import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { moveKanbanTask } from "@/lib/db/kanban";
import type { KanbanStatus } from "@/types";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const task = await moveKanbanTask(profileId, {
      taskId: body.taskId as number,
      newStatus: body.newStatus as KanbanStatus,
      newPosition: body.newPosition as number,
    });
    return jsonOk({ task });
  });
}
