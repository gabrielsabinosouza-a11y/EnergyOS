import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getPublicProfile, getBasicPublicProfile } from "@/lib/db/social";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    const { id } = await params;
    
    // Try to get full profile (requires friendship)
    try {
      const profile = await getPublicProfile(profileId, id);
      return NextResponse.json({ profile });
    } catch (error) {
      // If not friends, return basic public profile instead of 403
      if (error instanceof ForbiddenError) {
        const basicProfile = await getBasicPublicProfile(profileId, id);
        return NextResponse.json({ profile: basicProfile, isLimited: true });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
