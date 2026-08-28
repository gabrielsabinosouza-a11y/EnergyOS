import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import { getFocusRoomById, completeFocusRoom } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/complete — mark a room as completed.
// Any participant who finished their session may call this; it is idempotent.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) return notFound("Room not found");

    const completed = await completeFocusRoom(Number(roomId));
    return jsonOk({ room: completed, message: "Sessão concluída" });
  });
}
