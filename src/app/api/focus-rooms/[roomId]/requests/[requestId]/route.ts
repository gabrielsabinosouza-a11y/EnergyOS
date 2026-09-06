import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, badRequest } from "@/lib/http";
import { respondToJoinRequest } from "@/lib/db/focus-rooms";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ roomId: string; requestId: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const { requestId } = await params;
    if (body.action !== "accept" && body.action !== "reject") return badRequest("Ação inválida.");
    return jsonOk({ request: await respondToJoinRequest(Number(requestId), profileId, body.action === "accept") });
  });
}
