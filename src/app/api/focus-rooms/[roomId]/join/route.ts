import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import { getFocusRoomByCode, addParticipantToRoom, getFocusRoomById } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/join — join a room by its code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;
    const body = await readJsonBody(request);

    // Server-side logging for debugging
    console.log('[focus-rooms/join] Attempting to join room with code:', roomId);
    console.log('[focus-rooms/join] Participant profileId:', profileId);

    // Look up room by code (case-insensitive match)
    // Room codes are generated uppercase, but users might enter them in any case
    const room = await getFocusRoomByCode(roomId.toUpperCase());
    console.log('[focus-rooms/join] Room lookup result:', room ? 'FOUND' : 'NOT FOUND');

    if (!room) {
      console.log('[focus-rooms/join] Room not found for code:', roomId);
      return notFound("Room not found - check the code and try again");
    }

    if (room.status !== "waiting") {
      console.log('[focus-rooms/join] Cannot join room - status is not waiting:', room.status);
      return badRequest("Cannot join a room that has already started or completed");
    }

    // Add participant with their selected energy type
    const energyType = body.energyType as string | undefined;
    console.log('[focus-rooms/join] Adding participant with energyType:', energyType);

    await addParticipantToRoom(room.id, profileId, energyType);

    // Fetch updated room to return
    const updated = await getFocusRoomById(profileId, room.id);

    console.log('[focus-rooms/join] Successfully joined room:', room.id);
    return jsonOk({ room: updated, message: "Joined successfully" });
  });
}