import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { getRecaps, generateRecap } from "@/lib/db/recap";
import { BadRequestError } from "@/lib/errors";
import { todayIso } from "@/lib/db/dates";

function isDbError(error: unknown): error is { code: string; message: string; detail?: string; hint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const recaps = await getRecaps(profileId);
    return NextResponse.json({ recaps });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isDbError(error)) {
      console.error("[api/recap] GET DB error:", { code: error.code, message: error.message, detail: error.detail, hint: error.hint });
      return NextResponse.json(
        { error: `Erro no banco de dados: ${error.message}` },
        { status: 500 },
      );
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
    rateLimitForProfile(profileId, "recap-generate", 30, 3_600_000);

    // Check for optional month parameter (for generating past months)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");

    let monthStr: string;
    if (monthParam) {
      // Parse the month parameter (YYYY-MM format) and convert to start of month
      monthStr = monthParam.slice(0, 7) + "-01";
    } else {
      // Server decides the month: always the current month in America/Sao_Paulo
      const today = todayIso();
      monthStr = today.slice(0, 7) + "-01";
    }

    const recap = await generateRecap(profileId, monthStr);
    return NextResponse.json({ recap });
  } catch (error) {
    if (error instanceof AppError || error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isDbError(error)) {
      console.error("[api/recap] POST DB error:", { code: error.code, message: error.message, detail: error.detail, hint: error.hint });
      return NextResponse.json(
        { error: `Erro no banco de dados: ${error.message}` },
        { status: 500 },
      );
    }
    console.error("[api/recap] POST error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}