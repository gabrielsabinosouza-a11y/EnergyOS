import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import { ForbiddenError } from "@/lib/errors";
import {
  getFocusRoomById,
  getFocusRoomByCode,
  endFocusRoom,
  addParticipantToRoom,
  deleteFocusRoom,
} from "@/lib/db/focus-rooms";

function isNumeric(value: string) {
  return /^\d+$/.test(value);
}

// GET /api/focus-rooms/[roomId] — fetch by numeric ID
// GET /api/focus-rooms/[roomId] — fetch by room code (non-numeric)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = isNumeric(roomId)
      ? await getFocusRoomById(profileId, Number(roomId))
      : await getFocusRoomByCode(profileId, roomId);

    if (!room) return notFound("Room not found");
    return jsonOk({ room });
  });
}

// POST /api/focus-rooms/[roomId] — join a room by code or id
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;
    const body = await readJsonBody(request);

    const room = isNumeric(roomId)
      ? await getFocusRoomById(profileId, Number(roomId))
      : await getFocusRoomByCode(profileId, roomId);

    if (!room) return notFound("Room not found");
    if (room.status !== "waiting") return badRequest("Cannot join a room that has already started or completed");

    await addParticipantToRoom(room.id, profileId, body.energyType as string | undefined);
    const updated = isNumeric(roomId)
      ? await getFocusRoomById(profileId, Number(roomId))
      : await getFocusRoomByCode(profileId, roomId);

    return jsonOk({ room: updated, message: "Joined successfully" });
  });
}

// PATCH /api/focus-rooms/[roomId] — end a room (host only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { roomId } = await params;

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) return notFound("Room not found");
    if (room.hostProfileId !== profileId) throw new ForbiddenError("Only the host can end the room");

    const ended = await endFocusRoom(Number(roomId));
    return jsonOk({ room: ended, message: "Room ended successfully" });
  });
}

// DELETE /api/focus-rooms/[roomId] — permanently delete a room.
// Only the room's host (or an admin) can delete it.
// Active or paused rooms are automatically ended before deletion.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId, role } = await requireAuth(request);
    const { roomId } = await params;

    if (!isNumeric(roomId)) return badRequest("Invalid room ID");

    const room = await getFocusRoomById(profileId, Number(roomId));
    if (!room) return notFound("Room not found");

    if (room.hostProfileId !== profileId && role !== "admin") {
      throw new ForbiddenError("Only the host can delete this room");
    }

    await deleteFocusRoom(Number(roomId), profileId, role);
    return jsonOk({ ok: true, message: "Sala excluída com sucesso." });
  });
}