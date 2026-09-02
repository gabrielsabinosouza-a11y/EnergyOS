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
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
