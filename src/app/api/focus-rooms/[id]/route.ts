import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import {
  getFocusRoomById,
  startFocusRoom,
  endFocusRoom,
  removeParticipantFromRoom,
  participantGaveUp,
  participantCompleted,
} from "@/lib/db/focus-rooms";
import type { FocusRoom } from "@/lib/db/focus-rooms";

// GET /api/focus-rooms/[id] - Get room by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;

    const room = await getFocusRoomById(profileId, Number(id));
    if (!room) {
      return notFound("Room not found");
    }

    return jsonOk({ room });
  });
}

// PATCH /api/focus-rooms/[id]/end - End a focus room
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;

    const room = await getFocusRoomById(profileId, Number(id));
    if (!room) {
      return notFound("Room not found");
    }

    // Only host can end the room, or if the room is already completed
    if (room.hostProfileId !== profileId) {
      return badRequest("Only the host can end the room");
    }

    const endedRoom = await endFocusRoom(Number(id));
    return jsonOk({ room: endedRoom, message: "Room ended successfully" });
  });
}

// DELETE /api/focus-rooms/[id]/leave - Leave a focus room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;

    await removeParticipantFromRoom(Number(id), profileId);
    await participantGaveUp(Number(id), profileId);

    return jsonOk({ message: "Left the room successfully" });
  });
}
