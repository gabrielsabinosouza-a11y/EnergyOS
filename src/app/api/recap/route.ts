import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getRecaps, generateRecap } from "@/lib/db/recap";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const recaps = await getRecaps(profileId);
    return NextResponse.json({ recaps });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await request.json();
    const recap = await generateRecap(profileId, body.month);
    return NextResponse.json({ recap });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
