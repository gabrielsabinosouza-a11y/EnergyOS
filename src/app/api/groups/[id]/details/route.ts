import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { jsonOk, handleRoute, readJsonBody } from "@/lib/http";
import { updateGroupDetails, updateGroupAvatar } from "@/lib/db/groups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody(request);

    await updateGroupDetails(profileId, Number(id), {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      isPublic: body.isPublic as boolean | undefined,
      avatarEmoji: body.avatarEmoji as string | undefined,
    });

    if (body.avatarUrl !== undefined) {
      await updateGroupAvatar(profileId, Number(id), body.avatarUrl as string);
    }

    return jsonOk({ success: true });
  });
}
