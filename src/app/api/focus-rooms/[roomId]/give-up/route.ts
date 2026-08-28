import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import { getFocusRoomById, participantGaveUp } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/give-up — mark the current user as having
// given up on an active session (stays in the room history as "desistiu").
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) return notFound("Room not found");

    await participantGaveUp(Number(roomId), profileId);

    const updated = await getFocusRoomById(profileId, Number(roomId));
    return jsonOk({ room: updated, message: "Você desistiu da sessão." });
  });
}
