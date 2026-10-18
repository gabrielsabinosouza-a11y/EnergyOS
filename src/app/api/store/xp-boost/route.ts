import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { AppError } from "@/lib/errors";
import { getActiveBoost, getUserPotionInventory, purchaseXpBoost } from "@/lib/db/xp-boost";
import { XP_BOOST_ITEM_TYPE, XP_BOOST_MAX_HELD } from "@/lib/xp-boost";
import { BadRequestError } from "@/lib/errors";
import { assertObject, parseNumber, ValidationError } from "@/lib/db/validation";

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
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
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) throw new ValidationError("Corpo da requisição inválido.");
      throw error;
    }
    const payload = assertObject(body);
    const quantity = parseNumber(payload.quantity, "Quantidade", {
      min: 1,
      max: XP_BOOST_MAX_HELD,
      integer: true,
    });
    if (typeof payload.idempotencyKey !== "string") {
      throw new BadRequestError("Chave de compra inválida.");
    }

    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);
    const result = await purchaseXpBoost(profileId, quantity, payload.idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
