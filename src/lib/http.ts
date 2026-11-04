import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AppError, BadRequestError } from "./errors";
import { ValidationError } from "./db/validation";

const SLOW_REQUEST_THRESHOLD = 1000; // ms - log requests slower than this

// Track slow requests for monitoring
export const slowRequestLog: Array<{ route: string; method: string; duration: number; timestamp: number }> = [];

/**
 * Log a slow request for monitoring
 */
function logSlowRequest(route: string | undefined, method: string | undefined, duration: number): void {
  const entry = {
    route: route || 'unknown',
    method: method || 'unknown',
    duration,
    timestamp: Date.now(),
  };
  slowRequestLog.push(entry);

  // Keep only last 1000 entries
  if (slowRequestLog.length > 1000) {
    slowRequestLog.shift();
  }

  // Log to console for immediate visibility
  console.warn(`[PERF] Slow API request: ${method} ${route} took ${duration}ms`);
}

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

export interface RouteContext {
  route?: string;
  method?: string;
  profileId?: string;
}

/**
 * Mapeia erros de domínio para respostas HTTP consistentes: { error: string }.
 *
 * The optional mutable `context` object is read inside the catch block so that
 * route + user context is logged with every 500.  Handlers set `context.profileId`
 * after authenticating, so a server error log line always carries the user.
 */
export async function handleRoute(
  handler: (context: RouteContext) => Promise<NextResponse>,
  context?: RouteContext,
): Promise<NextResponse> {
  const ctx: RouteContext = { ...context };
  const startTime = Date.now();

  try {
    const response = await handler(ctx);

    // Track performance
    const duration = Date.now() - startTime;
    if (duration > SLOW_REQUEST_THRESHOLD) {
      logSlowRequest(ctx.route, ctx.method, duration);
    }

    return response;
  } catch (error) {
    // Still track performance for failed requests
    const duration = Date.now() - startTime;
    if (duration > SLOW_REQUEST_THRESHOLD) {
      logSlowRequest(ctx.route, ctx.method, duration);
    }

    if (error instanceof ValidationError) {
      console.error("[api] Validation error:", error.message, JSON.stringify(ctx));
      return jsonError(400, error.message);
    }
    if (error instanceof AppError) {
      console.error("[api] App error:", error.message, "Status:", error.status, JSON.stringify(ctx));
      return jsonError(error.status, error.message);
    }
    console.error(
      "[api] erro inesperado:",
      JSON.stringify({
        route: ctx.route,
        method: ctx.method,
        profileId: ctx.profileId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    return jsonError(500, "Erro interno do servidor.");
  }
}

/** Convenience: extract a human-readable route path + method from a NextRequest. */
export function routeContext(request: NextRequest, route?: string): RouteContext {
  try {
    return { route: route ?? new URL(request.url).pathname, method: request.method };
  } catch {
    return { route, method: request.method };
  }
}
const err = error as Error & {
  code?: string;
  detail?: string;
  column?: string;
  table?: string;
  constraint?: string;
  cause?: unknown;
};
console.error(
  "[api] erro inesperado:",
  JSON.stringify({
    route: ctx.route,
    method: ctx.method,
    profileId: ctx.profileId,
    duration: Date.now() - startTime,
    error: err instanceof Error ? err.message : String(error),
    code: err?.code,
    detail: err?.detail,
    table: err?.table,
    column: err?.column,
    constraint: err?.constraint,
    cause: err?.cause instanceof Error ? err.cause.message : err?.cause,
    stack: err instanceof Error ? err.stack : undefined,
  }),
);
