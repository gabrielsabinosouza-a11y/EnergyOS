import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { markGroupRead } from "@/lib/db/groups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    await markGroupRead(profileId, Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
