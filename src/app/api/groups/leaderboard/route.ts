import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getGlobalGroupLeaderboard, type Period } from "@/lib/db/group-leaderboard";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    
    const period = (searchParams.get("period") as Period) || "WEEK";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const validPeriods: Period[] = ["WEEK", "MONTH", "YEAR", "ALL_TIME"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const result = await getGlobalGroupLeaderboard(profileId, period, limit, offset);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}