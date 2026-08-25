import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { listKanbanTasks, createKanbanTask } from "@/lib/db/kanban";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    return jsonOk(await listKanbanTasks(profileId));
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
    });
    return jsonOk({ task }, 201);
  });
}
