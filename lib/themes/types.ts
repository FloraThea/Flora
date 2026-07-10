/** Identifiants officiels des thèmes Flora. */
export const FLORA_APP_THEMES = ["flora", "pop", "winter"] as const;

export type FloraAppThemeId = (typeof FLORA_APP_THEMES)[number];

export function isFloraAppTheme(value: unknown): value is FloraAppThemeId {
  return typeof value === "string" && FLORA_APP_THEMES.includes(value as FloraAppThemeId);
}

export function normalizeFloraAppTheme(value: unknown): FloraAppThemeId {
  return isFloraAppTheme(value) ? value : "flora";
}

export type FloraThemeDefinition = {
  id: FloraAppThemeId;
  name: string;
  emoji: string;
  description: string;
  preview: {
    background: string;
    accent: string;
    accent2: string;
    sidebar: string;
  };
};
