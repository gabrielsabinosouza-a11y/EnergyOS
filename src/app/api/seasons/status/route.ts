import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { getSeasonalStoreStatus } from "@/lib/db/store";

/**
 * Lightweight seasonal status for the "Loja" nav badge: whether a season is
 * active and how many seasonal items the user still doesn't own. Polled by
 * the sidebar/mobile nav; cheap enough to run every 30-60s.
 */
export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const status = await getSeasonalStoreStatus(profileId);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[seasons status GET] Error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
