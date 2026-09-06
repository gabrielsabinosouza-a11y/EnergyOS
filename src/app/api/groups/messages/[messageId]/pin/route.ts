import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { toggleGroupMessagePin } from "@/lib/db/groups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { messageId } = await params;
    // Body is optional: absent = toggle/unpin. When pinning, durationDays (7/14/30) sets expiry.
    const body = (await request.json().catch(() => null)) as { durationDays?: number } | null;
    await toggleGroupMessagePin(profileId, Number(messageId), { durationDays: body?.durationDays });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
