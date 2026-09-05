import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { getSettings, saveSettings, setLastSelectedAura, type SaveSettingsInput } from "@/lib/db/settings";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    return jsonOk(await getSettings(profileId));
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const auraType = body.lastSelectedAura === undefined ? null : (body.lastSelectedAura as string | null);
    return jsonOk(await setLastSelectedAura(profileId, auraType));
  });
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const input: SaveSettingsInput = {
      notificationsEnabled: body.notificationsEnabled as boolean | undefined,
      preferredTheme: body.preferredTheme as SaveSettingsInput["preferredTheme"],
      sleepTime: body.sleepTime === undefined ? undefined : (body.sleepTime as string | null),
      focusTime: body.focusTime === undefined ? undefined : (body.focusTime as string | null),
      soundNotificationsEnabled: body.soundNotificationsEnabled === undefined ? undefined : (body.soundNotificationsEnabled as boolean),
    };
    return jsonOk(await saveSettings(profileId, input));
  });
}
