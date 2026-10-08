import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { cancelConfirmation } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/cancel-confirmation - Host cancels pending confirmation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { roomId } = await params;

    const room = await cancelConfirmation(Number(roomId), profileId);
    return jsonOk({ room, message: "Confirmação cancelada" });
  });
}
