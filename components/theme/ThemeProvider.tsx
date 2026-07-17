"use client";

import { deferEffect } from "@/lib/hooks/defer-effect";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { normalizeFloraAppTheme, type FloraAppThemeId } from "@/lib/themes/types";
import {
  applyThemeToDocument,
  readStoredTheme,
  writeStoredTheme,
} from "@/lib/themes/storage";

type ThemeContextValue = {
  themeId: FloraAppThemeId;
  setThemeId: (themeId: FloraAppThemeId) => void;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  initialTheme?: FloraAppThemeId;
};

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [themeId, setThemeIdState] = useState<FloraAppThemeId>(
    initialTheme ?? readStoredTheme() ?? "flora",
  );
  const [isReady, setIsReady] = useState(false);

  const setThemeId = useCallback((next: FloraAppThemeId) => {
    const normalized = normalizeFloraAppTheme(next);
    setThemeIdState(normalized);
    applyThemeToDocument(normalized);
    writeStoredTheme(normalized);
  }, []);

  useEffect(() => {
    applyThemeToDocument(themeId);
    deferEffect(() => setIsReady(true));
  }, [themeId]);

  useEffect(() => {
    let cancelled = false;

    async function syncFromProfile() {
      try {
        const response = await fetch("/api/profil");
        if (!response.ok) return;
        const data = (await response.json()) as {
          values?: { personalization?: { appTheme?: unknown } };
        };
        const profileTheme = data.values?.personalization?.appTheme;
        if (!cancelled && profileTheme) {
          const normalized = normalizeFloraAppTheme(profileTheme);
          setThemeIdState(normalized);
          applyThemeToDocument(normalized);
          writeStoredTheme(normalized);
        }
      } catch {
        /* profil indisponible — thème local conservé */
      }
    }

    void syncFromProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ themeId, setThemeId, isReady }),
    [themeId, setThemeId, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useFloraTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useFloraTheme doit être utilisé dans ThemeProvider.");
  }
  return context;
}

export function useFloraThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
