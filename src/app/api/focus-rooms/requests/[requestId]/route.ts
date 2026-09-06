import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import { getJoinRequestStatus } from "@/lib/db/focus-rooms";

export async function GET(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const result = await getJoinRequestStatus(profileId, Number((await params).requestId));
    if (!result) return notFound("Solicitação não encontrada.");
    return jsonOk({ request: result });
  });
}
