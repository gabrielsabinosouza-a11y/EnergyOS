import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { ForbiddenError } from "@/lib/errors";
import { getFocusRoomById, restartFocusRoom } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/restart — host "Play Again".
// Only a COMPLETED room can be restarted. The room moves to 'restarting': every
// still-present participant is prompted to confirm (join the next round) or
// cancel (leave). The room actually restarts (flips to ACTIVE) once everyone
// still in the room has confirmed — see restartFocusRoom / maybeFinalizeRestart.
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

    const restartingRoom = await restartFocusRoom(Number(roomId), profileId);
    return jsonOk({
      room: restartingRoom,
      message: restartingRoom.status === "active"
        ? "Sessão reiniciada!"
        : "Todos os participantes serão notificados. Espera a confirmação para começar.",
    });
  });
}