import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { markDmRead } from "@/lib/db/messages";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { friendId } = await params;
    await markDmRead(profileId, friendId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
