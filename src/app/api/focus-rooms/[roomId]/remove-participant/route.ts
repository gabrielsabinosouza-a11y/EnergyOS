import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { handleRoute, jsonOk, notFound, badRequest } from "@/lib/http";
import { removeParticipantFromRoomDuringConfirmation } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/[roomId]/remove-participant - Host removes participant during confirmation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { roomId } = await params;
    const body = await request.json();

    const participantProfileId = body.participantProfileId as string | undefined;
    if (!participantProfileId) {
      return badRequest("participantProfileId is required");
    }

    await removeParticipantFromRoomDuringConfirmation(Number(roomId), profileId, participantProfileId);
    return jsonOk({ message: "Participante removido" });
  });
}
