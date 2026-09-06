import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import { findFocusRoomByCode, addParticipantToRoom, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/join — join a room by its code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;
    const body = await readJsonBody(request);

    // Look up room by code (case-insensitive match) WITHOUT the membership
    // auth check — a brand-new joiner is by definition not a participant yet,
    // and this route is what registers them as one.
    // Room codes are generated uppercase, but users might enter them in any case
    const room = await findFocusRoomByCode(roomId.toUpperCase());

    if (!room) {
      return notFound("Room not found - check the code and try again");
    }

    if (room.status !== "waiting") {
      return badRequest("Cannot join a room that has already started or completed");
    }

    // Add participant with their selected energy type
    const energyType = body.energyType as string | undefined;
    await addParticipantToRoom(room.id, profileId, energyType);

    // Fetch updated room to return
    const updated = await getFocusRoomById(profileId, room.id);

    return jsonOk({ room: updated, message: "Joined successfully" });
  });
}