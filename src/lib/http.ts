import { NextResponse } from "next/server";
import { AppError, BadRequestError } from "./errors";
import { ValidationError } from "./db/validation";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function badRequest(message = "Requisição inválida."): NextResponse {
  return jsonError(400, message);
}

export function notFound(message = "Não encontrado."): NextResponse {
  return jsonError(404, message);
}

/**
 * Parses a JSON object body. Throws `BadRequestError` (an AppError) so that
 * both `handleRoute` and manual `catch (error instanceof AppError)` blocks in
 * routes map malformed/null/array bodies to 400 instead of a generic 500.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new BadRequestError("Corpo da requisição inválido.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError("Corpo JSON inválido.");
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
