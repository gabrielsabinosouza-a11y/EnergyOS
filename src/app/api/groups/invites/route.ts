import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { AppError } from "@/lib/errors";
import { listGroupInvites } from "@/lib/db/groups";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    return NextResponse.json({ invites: await listGroupInvites(profileId) });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
