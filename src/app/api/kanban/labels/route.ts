import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { listKanbanLabels, createKanbanLabel, deleteKanbanLabel } from "@/lib/db/kanban";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const labels = await listKanbanLabels(profileId);
    return jsonOk({ labels });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = await readJsonBody(request);
    const label = await createKanbanLabel(profileId, {
      name: body.name as string,
      color: body.color as string,
    });
    return jsonOk({ label }, 201);
  });
}
