import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import { ForbiddenError, ConflictError } from "@/lib/errors";
import { startFocusRoom, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/start - Start a focus room (host only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { roomId } = await params;
    const numericRoomId = Number(roomId);

    const room = await getFocusRoomById(profileId, numericRoomId);
    if (!room) {
      return notFound("Sala não encontrada.");
    }

    if (room.hostProfileId !== profileId) {
      throw new ForbiddenError("Apenas o anfitrião pode iniciar a sala.");
    }

    if (room.status === "completed" || room.status === "expired") {
      throw new ConflictError("Esta sala já foi concluída.");
    }

    if (room.status !== "waiting" && room.status !== "active" && room.status !== "paused" &&
        room.status !== "confirming" && room.status !== "restarting") {
      throw new ConflictError("A sala não está aguardando início.");
    }

    const startedRoom = await startFocusRoom(numericRoomId, profileId);
    return jsonOk({ room: startedRoom, message: "Sala iniciada com sucesso.", serverTime: new Date().toISOString() });
  });
}
