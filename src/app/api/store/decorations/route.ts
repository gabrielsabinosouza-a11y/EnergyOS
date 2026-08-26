import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { purchaseDecoration, equipDecoration } from "@/lib/db/store";

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await request.json();
    const result = await purchaseDecoration(profileId, body.decorationId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await request.json();
    await equipDecoration(profileId, body.decorationId ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
