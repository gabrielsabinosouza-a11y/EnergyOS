import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getBannerStatus, unlockBanner, updateBannerImage } from "@/lib/db/store";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const status = await getBannerStatus(profileId);
    return NextResponse.json(status);
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
    const body = await request.json();
    if (body.action === "unlock") {
      const result = await unlockBanner(profileId);
      return NextResponse.json(result);
    }
    if (body.action === "update" && body.imageUrl) {
      await updateBannerImage(profileId, body.imageUrl);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
