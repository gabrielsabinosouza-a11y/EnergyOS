import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { getFocusRoomById, stopFocusRoom } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/stop — host "Parar". Marks ONLY the host's own
// session as given up (their energy is extinguished, no completion reward) while
// the shared room timer keeps running for the other participants, who can still
// complete the session normally.
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
      return badRequest("Only the host can stop the room");
    }

    if (room.status !== "active" && room.status !== "paused") {
      return badRequest("Room is not in progress");
    }

    const stopped = await stopFocusRoom(Number(roomId), profileId);
    return jsonOk({ room: stopped, message: "Sua sessão foi encerrada; a sala continua para os outros." });
  });
}