import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import {
  getFocusRoomById,
  getFocusRoomByCode,
  endFocusRoom,
  removeParticipantFromRoom,
  participantGaveUp,
  addParticipantToRoom,
} from "@/lib/db/focus-rooms";

function isNumeric(value: string) {
  return /^\d+$/.test(value);
}

// GET /api/focus-rooms/[id] — fetch by numeric ID
// GET /api/focus-rooms/[code] — fetch by room code (non-numeric)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;

    const room = isNumeric(id)
      ? await getFocusRoomById(profileId, Number(id))
      : await getFocusRoomByCode(id);

    if (!room) return notFound("Room not found");
    return jsonOk({ room });
  });
}

// POST /api/focus-rooms/[code] — join a room by code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);

    const room = isNumeric(id)
      ? await getFocusRoomById(profileId, Number(id))
      : await getFocusRoomByCode(id);

    if (!room) return notFound("Room not found");
    if (room.status !== "waiting") return badRequest("Cannot join a room that has already started or completed");

    await addParticipantToRoom(room.id, profileId, body.energyType as string | undefined);
    const updated = isNumeric(id)
      ? await getFocusRoomById(profileId, Number(id))
      : await getFocusRoomByCode(id);

    return jsonOk({ room: updated, message: "Joined successfully" });
  });
}

// PATCH /api/focus-rooms/[id] — end a room (host only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;

    const room = await getFocusRoomById(profileId, Number(id));
    if (!room) return notFound("Room not found");
    if (room.hostProfileId !== profileId) return badRequest("Only the host can end the room");

    const ended = await endFocusRoom(Number(id));
    return jsonOk({ room: ended, message: "Room ended successfully" });
  });
}

// DELETE /api/focus-rooms/[id] — leave a room
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
