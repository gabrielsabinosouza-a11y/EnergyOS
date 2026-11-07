import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError, BadRequestError } from "@/lib/errors";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { ensureUserBootstrap } from "@/lib/db/bootstrap";
import { getRecaps, generateRecap } from "@/lib/db/recap";
import { todayIso } from "@/lib/db/dates";
import { ValidationError } from "@/lib/db/validation";

type DbError = {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  position?: string;
  where?: string;
  constraint?: string;
};

function isDbError(error: unknown): error is DbError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

function handleError(label: string, error: unknown) {
  if (error instanceof AppError || error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (isDbError(error)) {
    console.error(`[api/recap] ${label} DB error:`, {
      code: error.code,
      message: error.message,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      where: error.where,
      constraint: error.constraint,
      table: (error as { table?: string }).table,
      column: (error as { column?: string }).column,
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: isProd ? "Erro interno." : `Erro no banco de dados: ${error.message}` },
      { status: 500 },
    );
  }
  const isProd = process.env.NODE_ENV === "production";
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[api/recap] ${label} error:`, { message: detail, stack: error instanceof Error ? error.stack : undefined });
  return NextResponse.json({ error: isProd ? "Erro interno." : detail }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    const recaps = await getRecaps(profileId);
    return NextResponse.json({ recaps });
  } catch (error) {
    return handleError("GET", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await requireAuth(request);
    await ensureUserBootstrap(profileId);

    // Rate limiting: 30 generations per hour
    rateLimitForProfile(profileId, "recap-generate", 30, 3_600_000);

    // Optional month parameter (YYYY-MM) for generating past months
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");

    let monthStr: string;
    if (monthParam) {
      if (!/^\d{4}-(0[1-9]|1[0-2])/.test(monthParam)) {
        throw new BadRequestError("Parâmetro month inválido. Use YYYY-MM.");
      }
      monthStr = monthParam.slice(0, 7) + "-01";
    } else {
      // Server decides: always the current month in America/Sao_Paulo
      monthStr = todayIso().slice(0, 7) + "-01";
    }

    const recap = await generateRecap(profileId, monthStr);
    return NextResponse.json({ recap });
  } catch (error) {
    return handleError("POST", error);
  }
}