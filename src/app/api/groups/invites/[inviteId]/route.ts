import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { respondToGroupInvite } from "@/lib/db/groups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const response = body.response;
    if (response !== "accepted" && response !== "rejected") {
      return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
    }
    const { inviteId } = await params;
    await respondToGroupInvite(profileId, Number(inviteId), response);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
