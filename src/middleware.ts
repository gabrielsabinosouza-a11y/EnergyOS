import { NextRequest, NextResponse } from "next/server";
import {
  isProtectedRoute,
  isGuestOnlyRoute,
  getAuthCookieName,
} from "@/lib/route-access";

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
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(getAuthCookieName())?.value;

  if (isProtectedRoute(pathname) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (isGuestOnlyRoute(pathname) && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Ignore Next.js internals and the favicon so we never intercept them.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
