import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { respondToConfirmation } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/respond-confirmation - Participant responds to confirmation prompt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { roomId } = await params;
    const body = await request.json();

    const accepted = body.accepted as boolean | undefined;
    if (typeof accepted !== "boolean") {
      return badRequest("accepted is required and must be a boolean");
    }

    const room = await respondToConfirmation(Number(roomId), profileId, accepted);
    return jsonOk({ room, message: accepted ? "Confirmado!" : "Você saiu da sala" });
  });
}
