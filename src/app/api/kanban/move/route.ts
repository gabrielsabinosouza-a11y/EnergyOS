import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { moveKanbanTask } from "@/lib/db/kanban";
import { awardKanbanCompletion } from "@/lib/db/kanban";
import type { KanbanStatus } from "@/types";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const taskId = body.taskId as number;
    const newStatus = body.newStatus as KanbanStatus;
    const task = await moveKanbanTask(profileId, {
      taskId,
      newStatus,
      newPosition: body.newPosition as number,
    });
    const { xpAwarded, coinsAwarded } =
      newStatus === "done"
        ? await awardKanbanCompletion(profileId, taskId)
        : { xpAwarded: 0, coinsAwarded: 0 };
    return jsonOk({ task, xpAwarded, coinsAwarded });
  });
}
