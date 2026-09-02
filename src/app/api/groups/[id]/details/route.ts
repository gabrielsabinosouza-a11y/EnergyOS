import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { jsonOk, handleRoute } from "@/lib/http";
import { updateGroupDetails, updateGroupAvatar } from "@/lib/db/groups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    await updateGroupDetails(profileId, Number(id), {
      name: body.name,
      description: body.description,
      isPublic: body.isPublic,
      avatarEmoji: body.avatarEmoji,
    });

    if (body.avatarUrl !== undefined) {
      await updateGroupAvatar(profileId, Number(id), body.avatarUrl);
    }

    return jsonOk({ success: true });
  });
}
