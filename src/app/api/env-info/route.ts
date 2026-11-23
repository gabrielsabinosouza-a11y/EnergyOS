import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";

/**
 * GET /api/env-info — sanitized environment report for debugging
 * "localhost vs Vercel show different data" issues. Authenticated only.
 * NEVER returns credentials: hosts and project ids only.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await requireAuth(request);
    const dbUrl = process.env.DATABASE_URL ?? "";
    let dbHost = "(unset)";
    try {
      dbHost = new URL(dbUrl).host;
    } catch { /* keep placeholder */ }
    return jsonOk({
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      dbHost,
      firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    });
  });
}
