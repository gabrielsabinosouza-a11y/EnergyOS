import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { ForbiddenError } from "@/lib/errors";
import { getFocusRoomById, restartFocusRoom } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/restart — host "Play Again".
// Only a COMPLETED room can be restarted: the same participants get a fresh
// ACTIVE session with the countdown reset. Each participant creates a new focus
// session client-side when they see the room flip back to active.
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
      throw new ForbiddenError("Only the host can restart the room");
    }

    if (room.status !== "completed") {
      return badRequest("A sala só pode ser reiniciada após a conclusão");
    }

    const restartedRoom = await restartFocusRoom(Number(roomId), profileId);
    return jsonOk({ room: restartedRoom, message: "Sessão reiniciada" });
  });
}