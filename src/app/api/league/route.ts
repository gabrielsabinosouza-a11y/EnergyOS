import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getLeagueSnapshot } from "@/lib/db/league";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const snapshot = await getLeagueSnapshot(profileId);
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
