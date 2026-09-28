import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { getStoreState, ensureDefaultAuras } from "@/lib/db/store";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    await ensureDefaultAuras(profileId);
    const state = await getStoreState(profileId);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[store GET] Error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
