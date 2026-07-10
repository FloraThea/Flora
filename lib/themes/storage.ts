import type { FloraAppThemeId } from "./types";
import { normalizeFloraAppTheme } from "./types";

export const FLORA_THEME_STORAGE_KEY = "flora-theme";

export function readStoredTheme(): FloraAppThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FLORA_THEME_STORAGE_KEY);
    return raw ? normalizeFloraAppTheme(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(themeId: FloraAppThemeId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLORA_THEME_STORAGE_KEY, themeId);
  } catch {
    /* ignore */
  }
}

export function applyThemeToDocument(themeId: FloraAppThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeId);
  document.documentElement.style.colorScheme = themeId === "winter" ? "dark" : "light";
}
