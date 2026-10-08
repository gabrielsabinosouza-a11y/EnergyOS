import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError, ForbiddenError } from "@/lib/errors";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { getPublicProfile, getBasicPublicProfile } from "@/lib/db/social";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
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
      // NotFoundError extends AppError, so re-throwing it will be caught
      // by the outer catch and return 404 correctly
      throw error;
    }
  } catch (error) {
    if (error instanceof AppError) {
      // NotFoundError (404), ValidationError (400), etc.
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[profile] Unhandled error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
