import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { listDirectMessages, sendDirectMessage } from "@/lib/db/messages";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { friendId } = await params;
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
    const { friendId } = await params;
    const body = await request.json();
    const message = await sendDirectMessage(profileId, friendId, body.body);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
