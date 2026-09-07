import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound } from "@/lib/http";
import { ValidationError } from "@/lib/db/validation";
import { getFocusRoomById, respondToRestart } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/restart/respond — any participant answers the
// host's "Play Again" prompt.
//   body: { accepted: true }  → stay in the room and join the next round.
//   body: { accepted: false } → leave the room.
// When every still-present participant has confirmed, the room automatically
// flips back to ACTIVE right here, so the last confirmation starts the session.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) return notFound("Room not found");

    const body = await readJsonBody(request);
    const accepted = body.accepted;
    if (typeof accepted !== "boolean") {
      throw new ValidationError("opção inválida (esperava accepted: true|false)");
    }

    const updated = await respondToRestart(Number(roomId), profileId, accepted);
    return jsonOk({
      room: updated,
      message: accepted ? "Confirmado — pronto para a próxima sessão." : "Você saiu da sala.",
    });
  });
}