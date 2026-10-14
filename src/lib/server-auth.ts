import type { NextRequest } from "next/server";
import { UnauthorizedError } from "./errors";
import { parseProfileId } from "./db/validation";
import { touchLastActive, getUserRole } from "./db/profiles";

/**
 * Validates that required environment variables are set.
 * Call this at the start of any API route that uses authentication.
 */
export function validateAuthEnv(): void {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");

  if (missing.length > 0) {
    throw new Error(
      `[Server Auth Error] Missing required environment variables: ${missing.join(", ")}. ` +
      "Server-side authentication will not work. Please check your environment variables. See .env.example for required variables."
    );
  }
}

interface VerifiedIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}

interface CacheEntry {
  identity: VerifiedIdentity;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const identityCache = new Map<string, CacheEntry>();

function extractToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null;
  }
  return null;
}

/**
 * Verifica um ID token do Firebase usando o endpoint oficial Identity Toolkit.
 * Não requer credenciais de admin — usa a mesma API key pública do frontend.
 */
async function verifyWithGoogle(token: string): Promise<VerifiedIdentity> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new UnauthorizedError(
      "Autenticação não configurada no servidor: NEXT_PUBLIC_FIREBASE_API_KEY is missing. " +
      "Please check your environment variables. See .env.example for required variables."
    );
  }

  const cached = identityCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new UnauthorizedError("Sessão inválida ou expirada.");
  const body = (await response.json()) as {
    users?: Array<{
      localId: string;
      email?: string;
      emailVerified?: boolean;
      displayName?: string;
      photoUrl?: string;
    }>;
  };
  const user = body.users?.[0];
  if (!user?.localId) throw new UnauthorizedError("Sessão inválida ou expirada.");
  // SECURITY: an account created with someone else's email is not verified.
  // Require verification before honoring the identity (prevents impersonation
  // in email-keyed checks such as admin actions).
  // Disabled at user request so accounts created before verification flow can use the app.
  if (user.email && user.emailVerified === false && process.env.AUTH_ENFORCE_VERIFIED === "true") {
    throw new UnauthorizedError("Confirme seu e-mail para continuar.");
  }

  const identity: VerifiedIdentity = {
    uid: user.localId,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoUrl: user.photoUrl ?? null,
  };
  identityCache.set(token, { identity, expiresAt: Date.now() + CACHE_TTL_MS });
  if (identityCache.size > 500) {
    const oldest = identityCache.keys().next().value;
    if (oldest !== undefined) identityCache.delete(oldest);
  }
  return identity;
}

function devBypassProfileId(request: NextRequest): string | null {
  // SECURITY: This bypass can ONLY work when ALL of these are true:
  // 1. NODE_ENV is "development" (not "production")
  // 2. DEV_AUTH_BYPASS is explicitly "true"
  // 3. DEV_PROFILE_ID is set to a valid profile ID format
  // This ensures the bypass is IMPOSSIBLE in production, regardless of other flags.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true" &&
    process.env.DEV_PROFILE_ID
  ) {
    const bypassProfileId = process.env.DEV_PROFILE_ID;
    try {
      return parseProfileId(bypassProfileId);
    } catch {
      console.error("[Dev Bypass] Invalid DEV_PROFILE_ID format:", bypassProfileId);
      return null;
    }
  }

  // Fall back to the existing AUTH_ALLOW_UNVERIFIED mechanism for backward compatibility
  if (process.env.AUTH_ALLOW_UNVERIFIED !== "true") return null;
  if (process.env.NODE_ENV === "production") return null;
  const header = request.headers.get("x-dev-profile-id");
  if (!header) return null;
  try {
    return parseProfileId(header);
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest {
  profileId: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  role: "user" | "admin";
}

/** Garante isolamento por usuário: todo endpoint resolve o perfil pelo token, nunca por parâmetro do cliente. */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedRequest> {
  validateAuthEnv();

  const devProfileId = devBypassProfileId(request);
  if (devProfileId) {
    touchLastActive(devProfileId);
    const role = await getUserRole(devProfileId);
    return { profileId: devProfileId, email: null, displayName: null, photoUrl: null, role };
  }

  const token = extractToken(request);
  if (!token) {
    throw new UnauthorizedError();
  }

  const identity = await verifyWithGoogle(token);

  const profileId = parseProfileId(identity.uid);
  touchLastActive(profileId);
  const role = await getUserRole(profileId);
  return { profileId, email: identity.email, displayName: identity.displayName, photoUrl: identity.photoUrl, role };
}

/** Verifica se o usuário autenticado tem permissão de admin */
export async function requireAdmin(request: NextRequest): Promise<AuthenticatedRequest> {
  validateAuthEnv();

  const auth = await requireAuth(request);
  if (auth.role !== 'admin') {
    throw new UnauthorizedError("Permissão de administrador necessária.");
  }
  return auth;
}
