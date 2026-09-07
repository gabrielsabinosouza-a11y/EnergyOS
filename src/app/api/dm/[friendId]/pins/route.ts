import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getDirectPinnedMessages } from "@/lib/db/messages";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { friendId } = await params;
    const pins = await getDirectPinnedMessages(profileId, friendId);
    return NextResponse.json({ pins });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
