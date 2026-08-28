import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { pauseFocusRoom, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/pause - Pause a focus room session (host only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) {
      return notFound("Room not found");
    }

    if (room.hostProfileId !== profileId) {
      return badRequest("Only the host can pause the room");
    }

    if (room.status !== "active") {
      return badRequest("Room is not in an active state");
    }

    const pausedRoom = await pauseFocusRoom(Number(roomId), profileId);
    return jsonOk({ room: pausedRoom, message: "Room paused successfully" });
  });
}
