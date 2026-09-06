import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, badRequest } from "@/lib/http";
import { getOwnerPendingJoinRequests, respondToJoinRequest } from "@/lib/db/focus-rooms";

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    return jsonOk({ requests: await getOwnerPendingJoinRequests(profileId, Number((await params).roomId)) });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const requestId = Number((await params).roomId);
    if (!Number.isInteger(requestId) || (body.action !== "accept" && body.action !== "reject")) return badRequest("Ação inválida.");
    return jsonOk({ request: await respondToJoinRequest(requestId, profileId, body.action === "accept") });
  });
}
