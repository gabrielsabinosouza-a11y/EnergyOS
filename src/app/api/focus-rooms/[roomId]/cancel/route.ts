import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import { cancelRoomParticipantGrace, getFocusRoomById } from "@/lib/db/focus-rooms";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { roomId } = await params;
    const numericRoomId = Number(roomId);
    const room = await getFocusRoomById(profileId, numericRoomId);
    if (!room) return notFound("Room not found");

    await cancelRoomParticipantGrace(numericRoomId, profileId);
    const updated = await getFocusRoomById(profileId, numericRoomId);
    return jsonOk({ room: updated, message: "Sessão cancelada." });
  });
}
