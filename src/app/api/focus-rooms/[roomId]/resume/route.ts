import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { ForbiddenError } from "@/lib/errors";
import { resumeFocusRoom, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/resume - Resume a paused focus room (host only)
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
      throw new ForbiddenError("Only the host can resume the room");
    }

    if (room.status !== "paused") {
      return badRequest("Room is not paused");
    }

    const resumedRoom = await resumeFocusRoom(Number(roomId), profileId);
    return jsonOk({ room: resumedRoom, message: "Room resumed successfully" });
  });
}
