import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { listKanbanTasks, createKanbanTask, listKanbanLabels, createKanbanLabel, deleteKanbanLabel } from "@/lib/db/kanban";
import type { KanbanLabel } from "@/types";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const tasks = await listKanbanTasks(profileId);
    const labels = await listKanbanLabels(profileId);
    return jsonOk({ tasks, labels });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const task = await createKanbanTask(profileId, {
      title: body.title as string,
      description: body.description as string | undefined,
      status: body.status as "todo" | "doing" | "done" | undefined,
      category: body.category as any,
      labels: body.labels as string[] | undefined,
      dueDate: body.dueDate as string | undefined,
      priority: body.priority as "low" | "medium" | "high" | undefined,
      assigneeId: body.assigneeId as string | undefined,
    });
    return jsonOk({ task }, 201);
  });
}
