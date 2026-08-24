export const protectedRoutes = ["/", "/perfil", "/configuracoes", "/metas"] as const;

export function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getAuthCookieName() {
  return "energyos_session";
}
