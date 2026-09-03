import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { editGroupMessage, deleteGroupMessage } from "@/lib/db/groups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { messageId } = await params;
    const body = await readJsonBody(request);
    const groupId = Number(request.nextUrl.searchParams.get("groupId"));
    const message = await editGroupMessage(profileId, groupId, Number(messageId), body.body as string);
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
    const groupId = Number(request.nextUrl.searchParams.get("groupId"));
    await deleteGroupMessage(profileId, groupId, Number(messageId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
