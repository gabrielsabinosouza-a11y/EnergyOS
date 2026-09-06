import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { getFocusRoomStatus, removeParticipantFromRoom } from "@/lib/db/focus-rooms";

// DELETE /api/focus-rooms/[roomId]/leave — leave a room.
// Only valid for rooms that have NOT started (waiting/expired/completed): the
// participant row is removed cleanly. For ACTIVE/PAUSED rooms, leaving is the
// GIVE-UP flow — it must keep history and finalize the focus session
// (client-driven), so this route rejects instead of deleting that history.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const status = await getFocusRoomStatus(Number(roomId));
    if (status === null) {
      return notFound("Sala não encontrada.");
    }
    if (status === "active" || status === "paused") {
      return badRequest("Sala em andamento — use desistir para sair e manter seu histórico.");
    }

    await removeParticipantFromRoom(Number(roomId), profileId);

    return jsonOk({ message: "Você saiu da sala." });
  });
}
