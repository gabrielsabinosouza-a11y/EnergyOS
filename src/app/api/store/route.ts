import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { listDecorations, getUserDecorations, getEquippedDecorationId, getCoinBalance, getBannerStatus, getShieldCount, getOwnedAuras, getEquippedEnergyId, ensureDefaultAuras } from "@/lib/db/store";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureDefaultAuras(profileId).catch(() => null);
    const [decorations, userDecorations, equippedId, balance, banner, shields, ownedAuras, equippedEnergyId] = await Promise.all([
      listDecorations(),
      getUserDecorations(profileId),
      getEquippedDecorationId(profileId),
      getCoinBalance(profileId),
      getBannerStatus(profileId),
      getShieldCount(profileId),
      getOwnedAuras(profileId),
      getEquippedEnergyId(profileId),
    ]);
    const ownedIds = new Set(userDecorations.map((d) => d.decorationId));
    const items = decorations.map((dec) => ({
      ...dec,
      owned: ownedIds.has(dec.id),
      equipped: equippedId === dec.id,
    }));
    return NextResponse.json({ items, balance, banner, shieldCount: shields, ownedAuras, equippedEnergyId });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
