import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { activateXpBoost } from "@/lib/db/xp-boost";

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const result = await activateXpBoost(profileId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const err = error as Record<string, unknown> | null | undefined;
    console.error("[xp-boost activate POST] Unexpected error:", {
      message: error instanceof Error ? error.message : String(error),
      code: typeof err?.code === "string" || typeof err?.code === "number" ? err.code : undefined,
      detail: typeof err?.detail === "string" ? err.detail : undefined,
      hint: typeof err?.hint === "string" ? err.hint : undefined,
      constraint: typeof err?.constraint === "string" ? err.constraint : undefined,
      table: typeof err?.table === "string" ? err.table : undefined,
      where: typeof err?.where === "string" ? err.where : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
