import { NextRequest, NextResponse } from "next/server";
import {
  isProtectedRoute,
  isGuestOnlyRoute,
  getAuthCookieName,
} from "@/lib/route-access";
import { isAllowedMobileWebOrigin } from "@/lib/mobile-cors";

const corsMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const corsHeaders = "Accept, Authorization, Content-Type";

function addCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", corsMethods);
  response.headers.set("Access-Control-Allow-Headers", corsHeaders);

  const vary = response.headers.get("Vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "origin")) {
    response.headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
  }

  return response;
}

/**
 * Server-side route protection.
 *
 * - Protected routes (auth required) reached without a session are bounced to
 *   the index page, so a logged-out user can never land on /dashboard.
 * - Guest-only routes (/, /login, /cadastro) reached while a session exists are
 *   bounced to the dashboard, so the landing page is never shown to signed-in
 *   users (this also prevents the "logged-out user lands on /dashboard" glitch
 *   that used to happen after a logout when the cookie had not yet cleared).
 *   The root-page redirect runs before rendering, so the public landing page
 *   does not flash for visitors with a session cookie.
 *
 * Note: This uses a session cookie (energyos_session) for lightweight route protection.
 * API routes use Bearer token authentication via requireAuth() in server-auth.ts.
 * These are complementary: the cookie prevents access to protected pages, while
 * the Bearer token provides actual user identity and authorization in API calls.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const origin = isApiRoute ? request.headers.get("origin") ?? "" : "";
  const allowedOrigin = isApiRoute && isAllowedMobileWebOrigin(origin);

  if (isApiRoute && request.method === "OPTIONS") {
    if (!allowedOrigin) {
      return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    }

    return addCorsHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  const session = request.cookies.get(getAuthCookieName())?.value;

  if (isProtectedRoute(pathname) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const response = NextResponse.redirect(url);
    return allowedOrigin ? addCorsHeaders(response, origin) : response;
  }

  if (isGuestOnlyRoute(pathname) && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const response = NextResponse.redirect(url);
    return allowedOrigin ? addCorsHeaders(response, origin) : response;
  }

  const response = NextResponse.next();
  return allowedOrigin ? addCorsHeaders(response, origin) : response;
}

export const config = {
  // Ignore Next.js internals and the favicon so we never intercept them.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
