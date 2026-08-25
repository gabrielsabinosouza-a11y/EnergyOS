"use client";

import { createContext, useContext, useRef, useCallback } from "react";
import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = "energyos-theme";

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.setAttribute("data-theme", sys);
  } else {
    root.setAttribute("data-theme", theme);
  }
}

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === THEME_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeRef = useRef<Theme>(readSavedTheme());

  const getSnapshot = useCallback(() => themeRef.current, []);

  const getServerSnapshot = useCallback(() => "system" as Theme, []);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((newTheme: Theme) => {
    themeRef.current = newTheme;
    localStorage.setItem(THEME_KEY, newTheme);
    applyThemeToDOM(newTheme);
  }, []);

  // Apply theme on every render (works for initial mount and changes)
  if (typeof window !== "undefined") {
    applyThemeToDOM(theme);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
