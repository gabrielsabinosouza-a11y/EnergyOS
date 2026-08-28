import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import { cleanupStaleRooms } from "@/lib/db/focus-rooms";

// POST /api/focus-rooms/cleanup — runs the stale/expired room sweep.
// Triggered by an external scheduler (cron) or lazily whenever the list is
// fetched. Accepts optional query params: waitingTimeoutMs, retentionMs.
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const waitingTimeoutMs = Number(searchParams.get("waitingTimeoutMs") || 45 * 60 * 1000);
    const retentionMs = Number(searchParams.get("retentionMs") || 24 * 60 * 60 * 1000);

    const result = await cleanupStaleRooms(
      Number.isFinite(waitingTimeoutMs) ? waitingTimeoutMs : 45 * 60 * 1000,
      Number.isFinite(retentionMs) ? retentionMs : 24 * 60 * 60 * 1000,
    );

    return jsonOk({ ok: true, ...result });
  });
}
