export const protectedRoutes = ["/dashboard", "/perfil", "/configuracoes", "/metas", "/relatorio", "/api/test"] as const;
export const guestOnlyRoutes = ["/", "/login", "/cadastro"] as const;

export function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isGuestOnlyRoute(pathname: string) {
  return (guestOnlyRoutes as readonly string[]).includes(pathname);
}

export function getAuthCookieName() {
  return "energyos_session";
}
