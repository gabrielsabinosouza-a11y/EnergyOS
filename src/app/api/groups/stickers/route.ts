import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { getAvailableStickers } from "@/lib/db/groups";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    return NextResponse.json({ stickers: getAvailableStickers() });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
