import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import { ForbiddenError } from "@/lib/errors";
import { getFocusRoomById, cancelRestart } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/restart/cancel — host aborts a pending "Play
// Again" request: the room goes back to 'completed' and every answer is reset.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) return notFound("Room not found");

    if (room.hostProfileId !== profileId) {
      throw new ForbiddenError("Only the host can cancel the restart");
    }

    const updated = await cancelRestart(Number(roomId), profileId);
    return jsonOk({ room: updated, message: "Reinício cancelado." });
  });
}