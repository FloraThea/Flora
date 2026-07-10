import type { FloraAppThemeId } from "./types";
import type { FloraPaletteTone, PaletteKey } from "@/lib/timetable/subject-palette";

export type ThemedSubjectStyle = {
  base: string;
  light: string;
  dark: string;
  border: string;
  text: string;
};

/** Palettes de base par thème (remplace FLORA_PALETTE). */
export const THEME_BASE_PALETTES: Record<FloraAppThemeId, Record<PaletteKey, FloraPaletteTone>> = {
  flora: {
    sage: { base: "#9caf88", light: "#c5d4b8", dark: "#6d8560", border: "#b8ccb0", text: "#3d5235" },
    rose: { base: "#e8c4c4", light: "#f5e4e4", dark: "#b88989", border: "#e0b4b4", text: "#6b4545" },
    blue: { base: "#b8cce8", light: "#d4e4f5", dark: "#7a96b8", border: "#a8c0dc", text: "#3d5068" },
    yellow: { base: "#f0e4b8", light: "#faf3dc", dark: "#c4b078", border: "#e8dcb0", text: "#6b5e38" },
    violet: { base: "#c5b8d4", light: "#e4dcf0", dark: "#9a8ab0", border: "#d0c4de", text: "#524760" },
    orange: { base: "#f0d4b8", light: "#fce8d4", dark: "#c49a88", border: "#e8c8b0", text: "#6b4e38" },
  },
  pop: {
    sage: { base: "#C8F045", light: "#E4F99A", dark: "#9BC020", border: "#B8E030", text: "#2A3800" },
    rose: { base: "#FF4FD8", light: "#FF9AEC", dark: "#D400AD", border: "#FF70E0", text: "#4A0038" },
    blue: { base: "#3ECFCF", light: "#8AEAEA", dark: "#1FA8A8", border: "#55D8D8", text: "#004848" },
    yellow: { base: "#FFE566", light: "#FFF3A3", dark: "#E6C200", border: "#FFD633", text: "#3D3500" },
    violet: { base: "#FF9F4A", light: "#FFC88A", dark: "#E07020", border: "#FFB060", text: "#4A2800" },
    orange: { base: "#FF9F4A", light: "#FFD0A8", dark: "#E07020", border: "#FFB870", text: "#4A2800" },
  },
  winter: {
    sage: { base: "#A8E0F0", light: "#D4F0FA", dark: "#6BB8D0", border: "#90D0E8", text: "#0A3040" },
    rose: { base: "#F8FAFC", light: "#FFFFFF", dark: "#D0D8E0", border: "#E8ECF0", text: "#1A2838" },
    blue: { base: "#4169E1", light: "#7090F0", dark: "#2840A0", border: "#5078D8", text: "#FFFFFF" },
    yellow: { base: "#D4AF37", light: "#F0D878", dark: "#A88820", border: "#E0C050", text: "#2A2000" },
    violet: { base: "#C0C8D0", light: "#E0E8F0", dark: "#909AA8", border: "#D0D8E0", text: "#1A2430" },
    orange: { base: "#87CEEB", light: "#B8E4F8", dark: "#5090B8", border: "#70B8D8", text: "#0A2840" },
  },
};

const POP_SUBJECT_OVERRIDES: Record<string, ThemedSubjectStyle> = {
  Mathématiques: { base: "#FFE566", light: "#FFF3A3", dark: "#E6C200", border: "#FFD633", text: "#3D3500" },
  Français: { base: "#FF4FD8", light: "#FF9AEC", dark: "#D400AD", border: "#FF70E0", text: "#FFFFFF" },
  EPS: { base: "#FF9F4A", light: "#FFD0A8", dark: "#E07020", border: "#FFB870", text: "#4A2800" },
  "Arts plastiques": { base: "#2D8B4E", light: "#5AB878", dark: "#1A6030", border: "#3A9858", text: "#FFFFFF" },
  "Questionner le monde": { base: "#3ECFCF", light: "#8AEAEA", dark: "#1FA8A8", border: "#55D8D8", text: "#004848" },
  "Enseignement moral et civique": { base: "#FF6B6B", light: "#FFA8A8", dark: "#D84040", border: "#FF8888", text: "#4A0808" },
  Lecture: { base: "#C8F045", light: "#E4F99A", dark: "#9BC020", border: "#B8E030", text: "#2A3800" },
  Écriture: { base: "#FF4FD8", light: "#FF9AEC", dark: "#D400AD", border: "#FF70E0", text: "#FFFFFF" },
};

const WINTER_SUBJECT_OVERRIDES: Record<string, ThemedSubjectStyle> = {
  Mathématiques: { base: "#A8E0F0", light: "#D4F0FA", dark: "#6BB8D0", border: "#90D0E8", text: "#0A3040" },
  Français: { base: "#F8FAFC", light: "#FFFFFF", dark: "#D0D8E0", border: "#E8ECF0", text: "#1A2838" },
  "Arts plastiques": { base: "#D4AF37", light: "#F0D878", dark: "#A88820", border: "#E0C050", text: "#2A2000" },
  EPS: { base: "#4169E1", light: "#7090F0", dark: "#2840A0", border: "#5078D8", text: "#FFFFFF" },
  "Questionner le monde": { base: "#C0C8D0", light: "#E0E8F0", dark: "#909AA8", border: "#D0D8E0", text: "#1A2430" },
  Lecture: { base: "#87CEEB", light: "#B8E4F8", dark: "#5090B8", border: "#70B8D8", text: "#0A2840" },
  Sciences: { base: "#C0C8D0", light: "#E8ECF0", dark: "#909AA8", border: "#D8DCE0", text: "#1A2430" },
};

export function getThemeBasePalette(themeId: FloraAppThemeId): Record<PaletteKey, FloraPaletteTone> {
  return THEME_BASE_PALETTES[themeId];
}

export function getThemedSubjectOverride(
  themeId: FloraAppThemeId,
  subject: string,
  subSubject?: string,
): ThemedSubjectStyle | null {
  const key = `${subject} ${subSubject ?? ""}`.trim();
  if (themeId === "pop") {
    if (key.toLowerCase().includes("lecture")) return POP_SUBJECT_OVERRIDES.Lecture;
    if (key.toLowerCase().includes("écrit") || key.toLowerCase().includes("ecrit"))
      return POP_SUBJECT_OVERRIDES.Écriture;
    if (key.toLowerCase().includes("science")) return POP_SUBJECT_OVERRIDES["Questionner le monde"];
    return POP_SUBJECT_OVERRIDES[subject] ?? null;
  }
  if (themeId === "winter") {
    if (key.toLowerCase().includes("lecture")) return WINTER_SUBJECT_OVERRIDES.Lecture;
    if (key.toLowerCase().includes("science")) return WINTER_SUBJECT_OVERRIDES.Sciences;
    return WINTER_SUBJECT_OVERRIDES[subject] ?? null;
  }
  return null;
}
