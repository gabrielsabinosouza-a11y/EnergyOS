"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import {
  getActiveSeason,
  getNextSeasonStart,
  getSeasonEndDate,
  getSeasonOverride,
  SEASONS,
  type SeasonDef,
  type SeasonId,
} from "@/config/seasons";
import { SeasonalDecorations } from "./seasonal-decorations";

export interface SeasonContextValue {
  /** Season whose window is active right now (dev override applied). */
  season: SeasonDef | null;
  /** Season that should drive the store "Edição Limitada" section. */
  storeSeason: SeasonDef | null;
  /** True while a season window is active. */
  isActive: boolean;
  /** Instant the active season ends (23:59:59.999 SP). */
  endsAt: Date | null;
  /** Next start instant of `season` (for "Volta em …"). */
  nextStart: Date | null;
  /** User setting: seasonal themes on/off (default true). */
  themesEnabled: boolean;
}

const SeasonContext = createContext<SeasonContextValue>({
  season: null,
  storeSeason: null,
  isActive: false,
  endsAt: null,
  nextStart: null,
  themesEnabled: true,
});

const TICK_MS = 30_000;

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [themesEnabled, setThemesEnabled] = useState(true);

  // Re-resolve the season periodically so the theme flips at midnight SP
  // and the countdown stays honest without a reload.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // User preference: "Temas sazonais" (default ON). Fetched once per user and
  // re-fetched when the settings page saves.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setThemesEnabled(true);
      return;
    }
    let active = true;
    const load = () => {
      api
        .getSettings()
        .then((s) => {
          if (active) setThemesEnabled(s.seasonalThemesEnabled !== false);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("energyos:settings-changed", load);
    return () => {
      active = false;
      window.removeEventListener("energyos:settings-changed", load);
    };
  }, [user, loading]);

  const value = useMemo<SeasonContextValue>(() => {
    const override = getSeasonOverride(
      { NODE_ENV: process.env.NODE_ENV, SEASON_OVERRIDE: process.env.SEASON_OVERRIDE, NEXT_PUBLIC_FORCE_SEASON: process.env.NEXT_PUBLIC_FORCE_SEASON },
    );
    const season = getActiveSeason(now, override);
    // For the store section: active season wins; otherwise fall back to the
    // next upcoming season so "Volta em …" can be shown for owned items.
    const storeSeason = season ?? SEASONS.find((s) => getNextSeasonStart(s, now).getTime() > now.getTime()) ?? null;
    const effective = season;
    return {
      season: effective,
      storeSeason,
      isActive: !!effective,
      endsAt: effective ? getSeasonEndDate(effective, now) : null,
      nextStart: storeSeason ? getNextSeasonStart(storeSeason, now) : null,
      themesEnabled,
    };
  }, [now, themesEnabled]);

  // Drive the global data-season attribute for CSS theming. Removing the
  // attribute restores the default EnergyOS palette instantly.
  useEffect(() => {
    const root = document.documentElement;
    const themeKey = value.isActive && value.themesEnabled ? value.season!.theme : null;
    if (themeKey) {
      root.setAttribute("data-season", themeKey);
    } else {
      root.removeAttribute("data-season");
    }
    return () => root.removeAttribute("data-season");
  }, [value.isActive, value.themesEnabled, value.season]);

  return (
    <SeasonContext.Provider value={value}>
      {children}
      <SeasonalDecorations />
    </SeasonContext.Provider>
  );
}

export function useSeason(): SeasonContextValue {
  return useContext(SeasonContext);
}

/** True when `seasonId` matches the season currently driving the UI. */
export function useIsSeasonActive(seasonId: SeasonId): boolean {
  const { season, isActive } = useSeason();
  return isActive && season?.id === seasonId;
}
