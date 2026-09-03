import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server-auth";
import { UnauthorizedError } from "@/lib/errors";
import { handleRoute, jsonOk } from "@/lib/http";
import { parseNumber } from "@/lib/db/validation";
import { cleanupStaleRooms } from "@/lib/db/focus-rooms";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// POST /api/focus-rooms/cleanup — runs the stale/expired room sweep.
// Authorized either by an admin session or a shared cron secret (CRON_SECRET
// env; header "x-cron-secret" or "Authorization: Bearer <secret>") so an
// external scheduler can trigger it without a Firebase session.
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    let authorized = false;
    try {
      await requireAdmin(request);
      authorized = true;
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    }
    if (!authorized) {
      const secret = process.env.CRON_SECRET;
      const provided =
        request.headers.get("x-cron-secret") ??
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
        null;
      if (!secret || !provided || provided !== secret) {
        throw new UnauthorizedError("Não autorizado.");
      }
    }

    const { searchParams } = new URL(request.url);
    // Clamped to sane bounds instead of accepting raw unvalidated numbers.
    const waitingTimeoutMs = parseNumber(searchParams.get("waitingTimeoutMs"), "waitingTimeoutMs", {
      integer: true,
      min: MINUTE,
      max: 24 * HOUR,
      fallback: 45 * MINUTE,
    });
    const retentionMs = parseNumber(searchParams.get("retentionMs"), "retentionMs", {
      integer: true,
      min: HOUR,
      max: 30 * DAY,
      fallback: DAY,
    });

    const result = await cleanupStaleRooms(waitingTimeoutMs, retentionMs);

    return jsonOk({ ok: true, ...result });
  });
}
