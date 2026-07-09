import type { SchoolLevel } from "@/lib/programming/types";

/** Horaires hebdomadaires officiels cycle 2 (repères BO, heures en classe). */
const CYCLE2_HOURS: Record<string, number> = {
  Français: 10,
  Mathématiques: 5,
  "Questionner le monde": 3,
  "Arts plastiques": 1.5,
  "Éducation musicale": 1.5,
  EPS: 3,
  EMC: 1.25,
  Anglais: 1.5,
  Informatique: 1,
};

const CP_HOURS: Record<string, number> = {
  Français: 10,
  Mathématiques: 5,
  "Questionner le monde": 2.5,
  "Arts plastiques": 1.5,
  "Éducation musicale": 1.5,
  EPS: 3,
  EMC: 1,
  Anglais: 1,
  Informatique: 0.5,
};

const CM_HOURS: Record<string, number> = {
  Français: 9,
  Mathématiques: 5,
  "Questionner le monde": 3,
  "Arts plastiques": 1.5,
  "Éducation musicale": 1.5,
  EPS: 3,
  EMC: 1.25,
  Anglais: 1.5,
  Informatique: 1,
};

function hoursForLevel(level: SchoolLevel): Record<string, number> {
  if (level === "CP") return CP_HOURS;
  if (level === "CM1" || level === "CM2") return CM_HOURS;
  return CYCLE2_HOURS;
}

export function getOfficialWeeklyHours(levels: SchoolLevel[]): Record<string, number> {
  if (levels.length === 0) return { ...CYCLE2_HOURS };

  const merged: Record<string, number> = {};

  for (const level of levels) {
    const source = hoursForLevel(level);
    for (const [subject, hours] of Object.entries(source)) {
      merged[subject] = Math.max(merged[subject] ?? 0, hours);
    }
  }

  return merged;
}

export function mergeWeeklyHours(
  official: Record<string, number>,
  fromProgrammations: Record<string, number>[],
): Record<string, number> {
  const merged = { ...official };

  for (const source of fromProgrammations) {
    for (const [subject, hours] of Object.entries(source)) {
      if (hours > 0) {
        merged[subject] = Math.max(merged[subject] ?? 0, hours);
      }
    }
  }

  return merged;
}

export const EPS_PREFERRED_DAYS = ["Mardi", "Jeudi"] as const;
export const ARTS_PREFERRED_DAYS = ["Mercredi", "Vendredi"] as const;
export const QM_PREFERRED_DAYS = ["Mercredi", "Lundi"] as const;
