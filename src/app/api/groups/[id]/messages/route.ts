import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/http";
import { listGroupMessages, sendGroupMessage } from "@/lib/db/groups";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const afterId = request.nextUrl.searchParams.get("after");
    const messages = await listGroupMessages(profileId, Number(id), afterId ? Number(afterId) : undefined);
    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    rateLimitForProfile(profileId, "group-msg-send", 30, 60_000);
    const { id } = await params;
    const body = await readJsonBody(request);
    const message = await sendGroupMessage(profileId, Number(id), body.body as string, {
      messageType: body.messageType as string | undefined,
      mediaUrl: body.mediaUrl as string | undefined,
      mediaDurationSeconds: body.mediaDurationSeconds as number | undefined,
      replyToId: body.replyToId != null ? Number(body.replyToId) : undefined,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
