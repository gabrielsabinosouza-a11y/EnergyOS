import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { updateKanbanTask, deleteKanbanTask } from "@/lib/db/kanban";
import { awardKanbanCompletion } from "@/lib/db/kanban";
import pool from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const taskId = Number(id);
    
    // Check if this is a transition to "done" to trigger reward
    const currentTask = await pool.query<{ status: string }>(
      `select status from kanban_tasks where profile_id = $1 and id = $2`,
      [profileId, taskId],
    );
    const wasDone = currentTask.rows[0]?.status === "done";
    const becomingDone = body.status === "done" && !wasDone;
    
    const task = await updateKanbanTask(profileId, taskId, {
      title: body.title as string | undefined,
      description: body.description as string | null | undefined,
      status: body.status as "todo" | "doing" | "done" | undefined,
      categoryId: body.categoryId as number | undefined,
      position: body.position as number | undefined,
      labels: body.labels as string[] | undefined,
      dueDate: body.dueDate as string | null | undefined,
      priority: body.priority as "low" | "medium" | "high" | undefined,
      assigneeId: body.assigneeId as string | null | undefined,
    });
    
    const { xpAwarded, coinsAwarded } =
      becomingDone
        ? await awardKanbanCompletion(profileId, taskId)
        : { xpAwarded: 0, coinsAwarded: 0 };
    return jsonOk({ task, xpAwarded, coinsAwarded });
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
