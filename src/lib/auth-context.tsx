"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    if (!auth) {
      // Schedules the state update outside the synchronous effect body
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    const firebaseAuth = auth;
    return onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setSessionCookie();
      else clearSessionCookie();
    });
  }, []);

  const logout = async () => {
    if (auth) await signOut(auth);
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

export { auth } from "./firebase";
