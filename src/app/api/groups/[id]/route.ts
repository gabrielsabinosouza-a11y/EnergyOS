import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getGroupDetail } from "@/lib/db/groups";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const group = await getGroupDetail(profileId, Number(id));
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
