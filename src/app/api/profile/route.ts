import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { getProfile, upsertAndGetProfile, updateDisplayName, updatePhotoUrl } from "@/lib/db/profiles";
import { assertObject, parseTitle } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId, displayName, email } = await requireAuth(request);
    return jsonOk({ user: await upsertAndGetProfile(profileId, displayName ?? undefined, email ?? undefined) });
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId, displayName, email } = await requireAuth(request);
    const body = assertObject(await readJsonBody(request));
    await upsertAndGetProfile(profileId, displayName ?? undefined, email ?? undefined);
    if (body.photoUrl !== undefined) {
      return jsonOk({ user: await updatePhotoUrl(profileId, String(body.photoUrl)) });
    }
    if (body.displayName !== undefined) {
      return jsonOk({ user: await updateDisplayName(profileId, parseTitle(body.displayName, "Nome")) });
    }
    return jsonOk({ user: await getProfile(profileId) });
  });
}
