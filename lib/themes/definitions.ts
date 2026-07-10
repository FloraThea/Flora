import type { FloraThemeDefinition } from "./types";

export const FLORA_THEME_DEFINITIONS: FloraThemeDefinition[] = [
  {
    id: "flora",
    name: "Flora Classique",
    emoji: "🌿",
    description: "Vert sauge, rose poudré, eucalyptus aquarelle — l'ambiance naturelle d'origine.",
    preview: {
      background: "#f4f7f2",
      accent: "#9caf88",
      accent2: "#e8c4c4",
      sidebar: "#3d5a44",
    },
  },
  {
    id: "pop",
    name: "Flora Color Pop",
    emoji: "🌈",
    description: "Bulles colorées, couleurs vives et énergie — une interface joyeuse et moderne.",
    preview: {
      background: "#fffdf6",
      accent: "#ff4fd8",
      accent2: "#ffe566",
      sidebar: "#2d8b4e",
    },
  },
  {
    id: "winter",
    name: "Flora Nuit d'Hiver",
    emoji: "❄",
    description: "Bleu nuit, doré et flocons discrets — élégance d'un marché de Noël.",
    preview: {
      background: "#1a2744",
      accent: "#d4af37",
      accent2: "#a8e0f0",
      sidebar: "#0f1829",
    },
  },
];

export function getThemeDefinition(id: string): FloraThemeDefinition {
  return FLORA_THEME_DEFINITIONS.find((theme) => theme.id === id) ?? FLORA_THEME_DEFINITIONS[0];
}
