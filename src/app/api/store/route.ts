import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { listDecorations, getUserDecorations, getEquippedDecorationId, getCoinBalance, getBannerStatus, getShieldCount, getOwnedAuras, ensureDefaultAuras } from "@/lib/db/store";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const [decorations, userDecorations, equippedId, balance, banner, shields, ownedAuras] = await Promise.all([
      listDecorations(),
      getUserDecorations(profileId),
      getEquippedDecorationId(profileId),
      getCoinBalance(profileId),
      getBannerStatus(profileId),
      getShieldCount(profileId),
      ensureDefaultAuras(profileId).catch(() => null).then(async () => getOwnedAuras(profileId)),
    ]);
    const ownedIds = new Set(userDecorations.map((d) => d.decorationId));
    const items = decorations.map((dec) => ({
      ...dec,
      owned: ownedIds.has(dec.id),
      equipped: equippedId === dec.id,
    }));
    return NextResponse.json({ items, balance, banner, shieldCount: shields, ownedAuras });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
