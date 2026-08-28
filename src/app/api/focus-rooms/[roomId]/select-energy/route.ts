import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest, jsonError } from "@/lib/http";
import { updateParticipantEnergyType, getFocusRoomById } from "@/lib/db/focus-rooms";
import { getOwnedAuras } from "@/lib/db/store";
import { ENERGY_TYPES } from "@/lib/energy-assets";

// POST /api/focus-rooms/[roomId]/select-energy - Update participant's selected energy type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;
    const body = await readJsonBody(request);

    const energyType = body.energyType as string | undefined;
    if (!energyType) {
      return badRequest("energyType is required");
    }

    if (!ENERGY_TYPES.includes(energyType as (typeof ENERGY_TYPES)[number])) {
      return badRequest("Invalid energy type");
    }

    const ownedAuras = await getOwnedAuras(profileId);
    if (!ownedAuras.includes(energyType)) {
      return jsonError(403, "You do not own this energy type");
    }

    // Verify room exists and participant is in it
    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) {
      return notFound("Room not found");
    }

    // Check if participant is in the room
    const participant = room.participants.find(p => p.profileId === profileId);
    if (!participant) {
      return badRequest("You are not a participant in this room");
    }

    // Update participant's energy type
    await updateParticipantEnergyType(Number(roomId), profileId, energyType);

    // Return updated room
    const updatedRoom = await getFocusRoomById(profileId, Number(roomId));

    return jsonOk({ room: updatedRoom, message: "Energy type updated successfully" });
  });
}
