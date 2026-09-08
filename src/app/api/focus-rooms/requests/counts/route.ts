import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { getPendingJoinRequestCounts } from "@/lib/db/focus-rooms";

// GET /api/focus-rooms/requests/counts — pending join-request counts for the
// rooms the current user hosts. Surfaced on the salas list view so a host can
// spot an approval request without entering the room screen.
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    return jsonOk({ rooms: await getPendingJoinRequestCounts(profileId) });
  });
}