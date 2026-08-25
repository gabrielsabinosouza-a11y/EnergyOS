import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { ValidationError } from "./db/validation";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ValidationError("Corpo da requisição inválido.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Corpo JSON inválido.");
  }
}

/** Mapeia erros de domínio para respostas HTTP consistentes: { error: string }. */
export async function handleRoute(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("[api] Validation error:", error.message);
      return jsonError(400, error.message);
    }
    if (error instanceof AppError) {
      console.error("[api] App error:", error.message, "Status:", error.status);
      return jsonError(error.status, error.message);
    }
    console.error("[api] erro inesperado:", error);
    return jsonError(500, "Erro interno do servidor.");
  }
}
