import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import { updateRoomDuration, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/update-duration - Update room duration (host only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;
    const body = await readJsonBody(request);

    const durationMinutes = body.durationMinutes as number | undefined;
    if (!durationMinutes || durationMinutes <= 0) {
      return badRequest("durationMinutes is required and must be positive");
    }

    // Verify room exists
    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) {
      return notFound("Room not found");
    }

    // Only host can update duration
    if (room.hostProfileId !== profileId) {
      return badRequest("Only the host can update the room duration");
    }

    // Room must be in waiting state
    if (room.status !== "waiting") {
      return badRequest("Cannot update duration once the room has started");
    }

    // Update duration
    const updatedRoom = await updateRoomDuration(Number(roomId), profileId, durationMinutes);

    return jsonOk({ room: updatedRoom, message: "Duration updated successfully" });
  });
}
