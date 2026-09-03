import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/http";
import { listAchievementProgress, markAchievementSeen, toggleFeaturedAchievement } from "@/lib/db/achievements";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const achievements = await listAchievementProgress(profileId);
    return NextResponse.json({ achievements });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    await markAchievementSeen(profileId, body.achievementId as string);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const body = await readJsonBody(request);
    const result = await toggleFeaturedAchievement(profileId, body.achievementId as string);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
