"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import { getAuthCookieName } from "./route-access";

const COOKIE = getAuthCookieName();
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function setSessionCookie() {
  document.cookie = `${COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearSessionCookie() {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Mirror of `user` kept outside the render cycle so `logout` can await the
  // actual null-user transition (see logout below).
  const userRef = useRef<FirebaseUser | null>(null);

  useEffect(() => {
    if (!auth) {
      // Schedules the state update outside the synchronous effect body
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    const firebaseAuth = auth;
    return onAuthStateChanged(firebaseAuth, (u) => {
      userRef.current = u;
      setUser(u);
      setLoading(false);
      if (u) setSessionCookie();
      else clearSessionCookie();
    });
  }, []);

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    // Guarantee the null user has propagated into this provider before we
    // resolve, so callers that navigate immediately after logout can never
    // read a stale signed-in `user`. That race previously dropped logged-out
    // users onto "/" with a stale session, the landing page bounced them back
    // to "/dashboard", and the competing client-side redirects were dropped —
    // leaving an endless loading spinner on /dashboard. Bounded so logout can
    // never hang, even if the Firebase listener ever stalls.
    const deadline = Date.now() + 2500;
    while (userRef.current !== null && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 16));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Client-side fallback while the session cookie catches up with Firebase. */
export function useAuthRedirect(options?: { ifGuest?: string; ifAuthed?: string }) {
  const authValue = useAuth();
  const router = useRouter();
  const ifGuest = options?.ifGuest;
  const ifAuthed = options?.ifAuthed;
  const { user, loading } = authValue;

  useEffect(() => {
    if (loading) return;
    if (!user && ifGuest) {
      router.replace(ifGuest);
      return;
    }
    if (user && ifAuthed) {
      router.replace(ifAuthed);
    }
  }, [user, loading, router, ifGuest, ifAuthed]);

  return authValue;
}

export { auth } from "./firebase";
