import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, readJsonBody } from "@/lib/http";
import { getGardenEntries, importGardenEntries, type ImportGardenEntry } from "@/lib/db/focus";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const entries = await getGardenEntries(profileId);
    return jsonOk({ entries });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const raw = body.entries;
    if (!Array.isArray(raw)) return jsonOk({ imported: 0 });
    const entries = raw.filter((e): e is Record<string, unknown> => !!e && typeof e === "object") as unknown as ImportGardenEntry[];
    const imported = await importGardenEntries(profileId, entries);
    return jsonOk({ imported });
  });
}
