import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { getActiveBoost, getUserPotionInventory, purchaseXpBoost } from "@/lib/db/xp-boost";
import { XP_BOOST_ITEM_TYPE } from "@/lib/xp-boost";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const [inventory, boost] = await Promise.all([
      getUserPotionInventory(profileId),
      getActiveBoost(profileId),
    ]);
    return NextResponse.json({
      quantity: inventory?.quantity ?? 0,
      itemType: XP_BOOST_ITEM_TYPE,
      boost,
    });
  } catch (error) {
    console.error("[xp-boost GET] Failed to load boost status:", error);
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const result = await purchaseXpBoost(profileId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
