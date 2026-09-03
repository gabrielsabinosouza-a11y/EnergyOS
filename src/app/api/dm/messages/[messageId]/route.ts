import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { editDirectMessage, deleteDirectMessage } from "@/lib/db/messages";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { messageId } = await params;
    const body = await readJsonBody(request);
    const message = await editDirectMessage(profileId, Number(messageId), body.body as string);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { messageId } = await params;
    await deleteDirectMessage(profileId, Number(messageId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
