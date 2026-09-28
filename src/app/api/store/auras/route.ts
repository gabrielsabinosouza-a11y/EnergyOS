import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { purchaseAura } from "@/lib/db/store";

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const body = await readJsonBody(request);
    const result = await purchaseAura(profileId, body.auraType as string);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
