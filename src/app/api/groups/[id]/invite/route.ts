import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { inviteToGroup } from "@/lib/db/groups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    
    if (!Array.isArray(body.inviteIds)) {
      return NextResponse.json({ error: "inviteIds deve ser um array." }, { status: 400 });
    }
    
    await inviteToGroup(profileId, Number(id), body.inviteIds);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}