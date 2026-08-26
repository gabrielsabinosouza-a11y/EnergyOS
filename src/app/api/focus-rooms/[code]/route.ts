import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import {
  getFocusRoomByCode,
  addParticipantToRoom,
  startFocusRoom,
} from "@/lib/db/focus-rooms";

// GET /api/focus-rooms/[code] - Get room by code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { code } = await params;

    const room = await getFocusRoomByCode(code);
    if (!room) {
      return notFound("Room not found");
    }

    return jsonOk({ room });
  });
}

// POST /api/focus-rooms/[code]/join - Join a room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { code } = await params;
    const body = await readJsonBody(request);

    const room = await getFocusRoomByCode(code);
    if (!room) {
      return notFound("Room not found");
    }

    if (room.status !== "waiting") {
      return badRequest("Cannot join a room that has already started or completed");
    }

    const selectedEnergyType = body.energyType as string | undefined;
    await addParticipantToRoom(room.id, profileId, selectedEnergyType);

    // Return the updated room
    const updatedRoom = await getFocusRoomByCode(code);
    return jsonOk({ room: updatedRoom, message: "Joined successfully" });
  });
}
