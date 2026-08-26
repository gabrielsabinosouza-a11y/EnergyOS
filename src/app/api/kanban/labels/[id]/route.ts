import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { deleteKanbanLabel } from "@/lib/db/kanban";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    await deleteKanbanLabel(profileId, Number(id));
    return jsonOk({ ok: true });
  });
}
