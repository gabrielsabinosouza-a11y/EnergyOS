import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound } from "@/lib/http";
import { findFocusRoomByCode, addParticipantToRoom, createJoinRequest, getFocusRoomById } from "@/lib/db/focus-rooms";

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

    const energyType = body.energyType as string | undefined;
    const isParticipant = room.participants.some((participant) => participant.profileId === profileId);
    if (isParticipant) {
      await addParticipantToRoom(room.id, profileId, energyType);
      return jsonOk({ room: await getFocusRoomById(profileId, room.id), message: "Joined successfully" });
    }
    const joinRequest = await createJoinRequest(room.id, profileId, energyType);
    return jsonOk({ request: joinRequest, message: "Solicitação enviada ao anfitrião." });
  });
}