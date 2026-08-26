import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { listFriendRequests } from "@/lib/db/social";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const requests = await listFriendRequests(profileId);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
