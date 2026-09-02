import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import {
  getAllStreakShieldDesigns,
  getOwnedStreakShieldDesigns,
  getEquippedShieldDesignId,
  purchaseStreakShieldDesign,
  equipStreakShieldDesign,
} from "@/lib/db/store";
import { NotFoundError, ConflictError, ForbiddenError } from "@/lib/errors";

// GET /api/store/shield-designs - Get all available shield designs
export async function GET(request: Request) {
  try {
    const { profileId } = await requireAuth(request);
    
    const [designs, owned, equipped] = await Promise.all([
      getAllStreakShieldDesigns(),
      getOwnedStreakShieldDesigns(profileId),
      getEquippedShieldDesignId(profileId),
    ]);

    return NextResponse.json({
      designs,
      owned,
      equipped,
    });
  } catch (error) {
    console.error("Error fetching streak shield designs:", error);
    return NextResponse.json(
      { error: "Erro ao carregar designs de escudos" },
      { status: 500 },
    );
  }
}

// POST /api/store/shield-designs - Purchase a shield design
export async function POST(request: Request) {
  try {
    const { profileId } = await requireAuth(request);
    
    const body = await request.json();
    const { shieldDesignId } = body;

    if (!shieldDesignId || typeof shieldDesignId !== "string") {
      return NextResponse.json(
        { error: "ID do design do escudo é obrigatório" },
        { status: 400 },
      );
    }

    const result = await purchaseStreakShieldDesign(profileId, shieldDesignId);

    return NextResponse.json({
      success: true,
      balance: result.balance,
      ownedDesigns: result.ownedDesigns,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Error purchasing streak shield design:", error);
    return NextResponse.json(
      { error: "Erro ao comprar design do escudo" },
      { status: 500 },
    );
  }
}

// PATCH /api/store/shield-designs - Equip a shield design
export async function PATCH(request: Request) {
  try {
    const { profileId } = await requireAuth(request);
    
    const body = await request.json();
    const { shieldDesignId } = body;

    if (!shieldDesignId || typeof shieldDesignId !== "string") {
      return NextResponse.json(
        { error: "ID do design do escudo é obrigatório" },
        { status: 400 },
      );
    }

    const result = await equipStreakShieldDesign(profileId, shieldDesignId);

    return NextResponse.json({
      success: result.success,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Error equipping streak shield design:", error);
    return NextResponse.json(
      { error: "Erro ao equipar design do escudo" },
      { status: 500 },
    );
  }
}