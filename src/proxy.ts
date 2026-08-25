import { NextRequest, NextResponse } from "next/server";
import { isProtectedRoute, isGuestOnlyRoute, getAuthCookieName } from "@/lib/route-access";

export function proxy(request: NextRequest) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
