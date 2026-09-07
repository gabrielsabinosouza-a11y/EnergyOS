import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { getProfile, upsertAndGetProfile, updateDisplayName, updatePhotoUrl, updateFeaturedAchievements } from "@/lib/db/profiles";
import { assertObject, parseTitle, ValidationError } from "@/lib/db/validation";

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
    if (body.featuredAchievements !== undefined) {
      if (!Array.isArray(body.featuredAchievements) || body.featuredAchievements.some((id) => typeof id !== "string")) {
        throw new ValidationError("Destaques inválidos.");
      }
      return jsonOk({ user: await updateFeaturedAchievements(profileId, body.featuredAchievements) });
    }
    return jsonOk({ user: await getProfile(profileId) });
  });
}
