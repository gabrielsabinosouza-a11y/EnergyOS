import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { readJsonBody } from "@/lib/http";
import { getRecaps, generateRecap } from "@/lib/db/recap";
import { BadRequestError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const recaps = await getRecaps(profileId);
    return NextResponse.json({ recaps });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/recap] GET error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);

    // Rate limiting: 5 generations per hour
    rateLimitForProfile(profileId, "recap-generate", 5, 3_600_000);

    // Server decides the month: always the current month in America/Sao_Paulo
    const today = todayIso();
    const monthStr = today.slice(0, 7) + "-01";

    const recap = await generateRecap(profileId, monthStr);
    return NextResponse.json({ recap });
  } catch (error) {
    if (error instanceof AppError || error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/recap] POST error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}