import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { markRecapShared } from "@/lib/db/recap";
import { BadRequestError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const { profileId } = await requireAuth(request);
    
    const body = await request.json();
    const { recapId } = body;

    if (typeof recapId !== "number") {
      throw new BadRequestError("ID do recap inválido");
    }

    const result = await markRecapShared(profileId, recapId);

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      wasFirstShare: result.wasFirstShare,
      coinsAwarded: result.wasFirstShare ? 50 : 0,
    });
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error marking recap as shared:", error);
    return NextResponse.json(
      { error: "Erro ao processar compartilhamento" },
      { status: 500 },
    );
  }
}