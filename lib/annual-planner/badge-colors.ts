import type { FloraAccent } from "@/lib/theme";
import { getPaletteKeyForSubject, FLORA_PALETTE } from "@/lib/timetable/subject-palette";
import type { PlannerBadgeKind } from "./types";

const PALETTE_TO_ACCENT: Record<string, FloraAccent> = {
  sage: "sage",
  rose: "rose",
  blue: "lavender",
  yellow: "cream",
  violet: "lavender",
  orange: "peach",
};

const BADGE_KIND_ACCENT: Record<PlannerBadgeKind, FloraAccent> = {
  project: "lavender",
  sortie: "sage",
  evaluation: "rose",
  oeuvre: "rose",
  sequence: "cream",
  evenement: "lavender",
  reunion: "cream",
  intervention: "peach",
  apc: "sage",
  hours108: "peach",
  subject: "sage",
  rituel: "cream",
};

export function getBadgeAccent(kind: PlannerBadgeKind, subjectLabel?: string): FloraAccent {
  if (subjectLabel) {
    const paletteKey = getPaletteKeyForSubject(subjectLabel);
    return PALETTE_TO_ACCENT[paletteKey] ?? "sage";
  }
  return BADGE_KIND_ACCENT[kind] ?? "cream";
}

export function getSubjectAccent(subjectLabel: string): FloraAccent {
  const paletteKey = getPaletteKeyForSubject(subjectLabel);
  return PALETTE_TO_ACCENT[paletteKey] ?? "sage";
}

export function getPeriodAccent(periodNumber: number): FloraAccent {
  const accents: FloraAccent[] = ["sage", "lavender", "rose", "cream", "peach"];
  return accents[(periodNumber - 1) % accents.length] ?? "sage";
}

export function getSubjectColor(subjectLabel: string): string {
  const paletteKey = getPaletteKeyForSubject(subjectLabel);
  return FLORA_PALETTE[paletteKey].base;
}

export const SUBJECT_FILTER_OPTIONS = [
  "Mathématiques",
  "Français",
  "Arts plastiques",
  "EPS",
  "Sciences",
  "Histoire",
  "Géographie",
  "EMC",
  "Musique",
  "Anglais",
  "Questionner le monde",
] as const;

export const PROJECT_BADGE_KINDS: PlannerBadgeKind[] = [
  "project",
  "sortie",
  "evenement",
  "intervention",
  "oeuvre",
];
