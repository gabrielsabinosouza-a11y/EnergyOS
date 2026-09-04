import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { toggleDirectMessageReaction } from "@/lib/db/messages";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { messageId } = await params;
    const body = await readJsonBody(request);
    const message = await toggleDirectMessageReaction(profileId, Number(messageId), body.emoji);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
