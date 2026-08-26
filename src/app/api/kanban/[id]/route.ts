import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { updateKanbanTask, deleteKanbanTask } from "@/lib/db/kanban";
import { awardKanbanXP } from "@/lib/db/xp";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const taskId = Number(id);
    const task = await updateKanbanTask(profileId, taskId, {
      title: body.title as string | undefined,
      description: body.description as string | null | undefined,
      status: body.status as "todo" | "doing" | "done" | undefined,
      category: body.category as any,
      position: body.position as number | undefined,
      labels: body.labels as string[] | undefined,
      dueDate: body.dueDate as string | null | undefined,
      priority: body.priority as "low" | "medium" | "high" | undefined,
      assigneeId: body.assigneeId as string | null | undefined,
    });
    if (body.status === "done") {
      await awardKanbanXP(profileId, taskId);
    }
    return jsonOk({ task });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    await deleteKanbanTask(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}
