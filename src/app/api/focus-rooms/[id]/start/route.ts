import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { startFocusRoom, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[id]/start - Start a focus room (host only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;

    const room = await getFocusRoomById(profileId, Number(id));
    if (!room) {
      return notFound("Room not found");
    }

    if (room.hostProfileId !== profileId) {
      return badRequest("Only the host can start the room");
    }

    if (room.status !== "waiting") {
      return badRequest("Room is not in waiting state");
    }

    const startedRoom = await startFocusRoom(Number(id), profileId);
    return jsonOk({ room: startedRoom, message: "Room started successfully" });
  });
}
