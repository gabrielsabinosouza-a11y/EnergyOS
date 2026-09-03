import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { searchUsers } from "@/lib/db/social";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    rateLimitForProfile(profileId, "social-search", 30, 60_000);
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const results = await searchUsers(profileId, q);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
