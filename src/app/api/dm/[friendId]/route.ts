import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { AppError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/http";
import { listDirectMessages, sendDirectMessage, getDmReadMessageIds } from "@/lib/db/messages";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const { friendId } = await params;

    // Check if this is a read-messages query
    const isReadMessages = request.nextUrl.searchParams.get("readMessages") === "true";
    if (isReadMessages) {
      const sinceId = request.nextUrl.searchParams.get("since");
      const messageIds = await getDmReadMessageIds(
        profileId,
        friendId,
        sinceId ? Number(sinceId) : undefined,
      );
      return NextResponse.json({ messageIds: Array.from(messageIds) });
    }

    // Regular messages fetch
    const afterId = request.nextUrl.searchParams.get("after");
    const messages = await listDirectMessages(profileId, friendId, afterId ? Number(afterId) : undefined);
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
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    rateLimitForProfile(profileId, "dm-send", 20, 60_000);
    const { friendId } = await params;
    const body = await readJsonBody(request);
    const message = await sendDirectMessage(profileId, friendId, body.body as string, {
      messageType: body.messageType as string | undefined,
      mediaUrl: body.mediaUrl as string | undefined,
      mediaDurationSeconds: body.mediaDurationSeconds as number | undefined,
      mediaFileName: body.mediaFileName as string | undefined,
      mediaMimeType: body.mediaMimeType as string | undefined,
      mediaSizeBytes: body.mediaSizeBytes as number | undefined,
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