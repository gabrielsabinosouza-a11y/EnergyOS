import { NextRequest, NextResponse } from "next/server";
import { isProtectedRoute, getAuthCookieName } from "@/lib/route-access";

const PUBLIC_AUTH_ROUTES = ["/login", "/cadastro"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(getAuthCookieName())?.value;

  if (isProtectedRoute(pathname) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (PUBLIC_AUTH_ROUTES.includes(pathname) && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
