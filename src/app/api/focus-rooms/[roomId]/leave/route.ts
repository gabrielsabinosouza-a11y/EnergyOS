import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { removeParticipantFromRoom, participantGaveUp } from "@/lib/db/focus-rooms";

// DELETE /api/focus-rooms/[roomId]/leave — leave a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    await removeParticipantFromRoom(Number(roomId), profileId);
    await participantGaveUp(Number(roomId), profileId);

    return jsonOk({ message: "Left the room successfully" });
  });
}