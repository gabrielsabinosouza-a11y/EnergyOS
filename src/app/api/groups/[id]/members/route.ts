import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getGroupMemberContributions } from "@/lib/db/group-leaderboard";

type Period = "WEEK" | "MONTH" | "YEAR" | "ALL_TIME";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    const period = (searchParams.get("period") as Period) || "WEEK";
    const validPeriods: Period[] = ["WEEK", "MONTH", "YEAR", "ALL_TIME"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const result = await getGroupMemberContributions(profileId, Number(id), period);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}