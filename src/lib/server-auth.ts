import type { NextRequest } from "next/server";
import { UnauthorizedError } from "./errors";
import { parseProfileId } from "./db/validation";
import { touchLastActive } from "./db/profiles";

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
  if (!apiKey) throw new UnauthorizedError("Autenticação não configurada no servidor.");

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
    users?: Array<{ localId: string; email?: string; displayName?: string; photoUrl?: string }>;
  };
  const user = body.users?.[0];
  if (!user?.localId) throw new UnauthorizedError("Sessão inválida ou expirada.");

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
}

/** Garante isolamento por usuário: todo endpoint resolve o perfil pelo token, nunca por parâmetro do cliente. */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedRequest> {
  const devProfileId = devBypassProfileId(request);
  if (devProfileId) {
    console.log('[auth] Using dev bypass profile:', devProfileId);
    touchLastActive(devProfileId);
    return { profileId: devProfileId, email: null, displayName: null, photoUrl: null };
  }

  const token = extractToken(request);
  if (!token) {
    console.log('[auth] No token found in request');
    throw new UnauthorizedError();
  }

  console.log('[auth] Token found, attempting verification');
  const identity = await verifyWithGoogle(token);
  console.log('[auth] Token verified successfully for UID:', identity.uid);
  
  const profileId = parseProfileId(identity.uid);
  touchLastActive(profileId);
  return { profileId, email: identity.email, displayName: identity.displayName, photoUrl: identity.photoUrl };
}
