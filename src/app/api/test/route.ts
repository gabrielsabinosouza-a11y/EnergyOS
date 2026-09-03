import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk, notFound } from "@/lib/http";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    // Debug endpoint: never available in production builds.
    if (process.env.NODE_ENV === "production") {
      return notFound("Não encontrado.");
    }

    const { profileId, email, displayName } = await requireAuth(request);

    // Test database connection
    let database = "connected";
    try {
      await pool.query("SELECT 1");
    } catch {
      database = "unavailable";
      throw new Error("Database connection failed");
    }

    return jsonOk({
      message: "API test successful",
      auth: { profileId, email, displayName },
      database,
      timestamp: new Date().toISOString(),
    });
  });
}