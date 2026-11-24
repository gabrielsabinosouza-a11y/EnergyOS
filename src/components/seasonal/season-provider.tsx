"use client";


import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import {
  getActiveSeason,
  getDevNow,
  getNextSeasonStart,
  getSeasonEndDate,
  getSeasonOverride,
  nextSeasonBoundaryMs,
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
  // Per-user seasonal theme override (settings.seasonalTheme). A SeasonId
  // forces that theme/decorations as a preview; null = follow the calendar.
  const [seasonPref, setSeasonPref] = useState<SeasonId | null>(null);

  // Re-resolve the season so the theme/items flip exactly at a season
  // boundary (no reload), on tab focus, and periodically as a safety net.
  // `?now=ISO` (dev only) simulates a different "now" for QA.
  useEffect(() => {
    const refresh = () => setNow(getDevNow() ?? new Date());
    let boundaryTimer = 0;
    const alignToBoundary = () => {
      window.clearTimeout(boundaryTimer);
      const wait = Math.max(1_000, Math.min(nextSeasonBoundaryMs(new Date()), TICK_MS));
      boundaryTimer = window.setTimeout(() => {
        refresh();
        alignToBoundary();
      }, wait);
    };
    alignToBoundary();
    const interval = window.setInterval(refresh, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(boundaryTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // User preference: "Temas sazonais" (default ON). Fetched once per user and
  // re-fetched when the settings page saves.
  useEffect(() => {
    if (loading) return;
    let active = true;
    if (!user) {
      // Logged-out visitors get the default (themes on). Async setState keeps
      // the effect free of synchronous cascading renders.
      void Promise.resolve().then(() => {
        if (active) {
          setThemesEnabled(true);
          setSeasonPref(null);
        }
      });
      return () => { active = false; };
    }
    const load = () => {
      api
        .getSettings()
        .then((s) => {
          if (!active) return;
          setThemesEnabled(s.seasonalThemesEnabled !== false);
          const pref = s.seasonalTheme;
          setSeasonPref(pref && SEASONS.some((x) => x.id === pref) ? (pref as SeasonId) : null);
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
    // Dev override (?season= / env, dev builds only) wins over the user's
    // saved seasonal theme preference.
    const override =
      getSeasonOverride(
        { NODE_ENV: process.env.NODE_ENV, SEASON_OVERRIDE: process.env.SEASON_OVERRIDE, NEXT_PUBLIC_FORCE_SEASON: process.env.NEXT_PUBLIC_FORCE_SEASON },
      ) ?? seasonPref;
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
  }, [now, themesEnabled, seasonPref]);

  // Theme string that should be on <html>, or null for the default palette.
  const themeKey =
    value.isActive && value.themesEnabled ? value.season!.theme : null;

  const hasAppliedRef = useRef(false);

  // Drive the global data-season attribute for CSS theming.
  useEffect(() => {
    const root = document.documentElement;

    // Nothing to change: don't start a transition at all.
    if (root.getAttribute("data-season") === (themeKey ?? null)) {
      hasAppliedRef.current = true;
      return;
    }

    const apply = () => {
      if (themeKey) {
        root.setAttribute("data-season", themeKey);
      } else {
        root.removeAttribute("data-season");
      }
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // First application (page load) or no support: apply instantly, no animation.
    if (
      !hasAppliedRef.current ||
      reduceMotion ||
      typeof document.startViewTransition !== "function"
    ) {
      apply();
      hasAppliedRef.current = true;
      return;
    }

    const transition = document.startViewTransition(apply);

    // A newer transition may skip this one; that's expected, so swallow it.
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished.catch(() => {});
  }, [themeKey]);
  return (
    <SeasonContext.Provider value={value}>
      {/* Content sits above the particle layer so snow/confetti never render
          on top of text or cards. The layer itself is pointer-events:none. */}
      <div className="relative z-[2]">{children}</div>
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
