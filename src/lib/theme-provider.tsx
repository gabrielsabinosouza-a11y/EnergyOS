"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

type Theme = "system" | "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = "energyos-theme";

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "dark";
}

function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  root.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Read from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = readSavedTheme();
    setThemeState(saved);
    applyThemeToDOM(saved);

    // Keep in sync with system preference changes when theme === "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSysChange = () => {
      if (readSavedTheme() === "system") applyThemeToDOM("system");
    };
    mq.addEventListener("change", onSysChange);
    return () => mq.removeEventListener("change", onSysChange);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    applyThemeToDOM(newTheme);
  }, []);

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
