import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { promoteTaskToKanban } from "@/lib/db/kanban";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const task = await promoteTaskToKanban(profileId, Number(body.taskId));
    return jsonOk({ task }, 201);
  });
}
