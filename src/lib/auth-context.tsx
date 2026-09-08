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
    // Kill the session cookie first, synchronously. The proxy redirects every
    // guest-only route (including "/") to "/dashboard" while this cookie
    // exists, so it must be gone before the post-logout navigation runs —
    // not just whenever Firebase's auth-state listener happens to fire.
    clearSessionCookie();
    if (auth) {
      try {
        await signOut(auth);
      } catch {
        // A failed Firebase call must never strand the user with a live
        // client session; the local cleanup below still runs.
      }
    }
    // Give the null user a bounded window to propagate into this provider
    // before we resolve, so callers that navigate immediately after logout
    // usually see the settled state. Bounded so logout can never hang, even
    // if the Firebase listener ever stalls.
    const deadline = Date.now() + 2500;
    while (userRef.current !== null && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 16));
    }
    // Force the signed-out state regardless of the listener: a stale non-null
    // user here is what previously made the landing page's `ifAuthed` redirect
    // fire and drop the logged-out user onto "/dashboard".
    userRef.current = null;
    setUser(null);
    setLoading(false);
    clearSessionCookie();
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
