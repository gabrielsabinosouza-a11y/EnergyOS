import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { deleteGroup, leaveGroup, transferOwnership } from "@/lib/db/groups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const action: string = body.action;

    switch (action) {
      case "leave":
        await leaveGroup(profileId, Number(id));
        return NextResponse.json({ success: true });
      case "transfer":
        if (!body.targetProfileId) {
          return NextResponse.json({ error: "targetProfileId é obrigatório." }, { status: 400 });
        }
        await transferOwnership(profileId, Number(id), body.targetProfileId);
        return NextResponse.json({ success: true });
      case "delete":
        await deleteGroup(profileId, Number(id));
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
