import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody, notFound, badRequest } from "@/lib/http";
import { rateLimitForProfile } from "@/lib/rate-limit";
import {
  createFocusRoom,
  getFocusRoomByCode,
  getUserFocusRooms,
  startFocusRoom,
  endFocusRoom,
  addParticipantToRoom,
  getFocusRoomById,
} from "@/lib/db/focus-rooms";
import type { FocusRoom, RoomParticipant } from "@/lib/db/focus-rooms";

// GET /api/focus-rooms - List all rooms for the current user
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const rooms = await getUserFocusRooms(profileId);
    return jsonOk({ rooms });
  });
}

// POST /api/focus-rooms - Create a new focus room
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    rateLimitForProfile(profileId, "focus-room-create", 10, 60_000);
    const body = await readJsonBody(request);

    const durationMinutes = body.durationMinutes as number | undefined;
    const energyType = body.energyType as string | undefined;

    if (!durationMinutes || durationMinutes <= 0) {
      return badRequest("Duration is required and must be positive");
    }

    const room = await createFocusRoom(profileId, durationMinutes, energyType);
    return jsonOk({ room }, 201);
  });
}
