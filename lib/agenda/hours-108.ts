import type { FloraAccent } from "@/lib/theme";

export type Hours108CategoryDefinition = {
  code: string;
  label: string;
  color: FloraAccent;
  baseHoursAt100: number;
};

/** Répartition officielle des 108h à temps plein (100 %). */
export const HOURS_108_CATEGORIES: Hours108CategoryDefinition[] = [
  { code: "108_apc", label: "APC", color: "lavender", baseHoursAt100: 36 },
  { code: "108_animations", label: "Animations pédagogiques", color: "sage", baseHoursAt100: 36 },
  { code: "108_conseils", label: "Conseils d'école", color: "rose", baseHoursAt100: 18 },
  {
    code: "108_equipe_familles",
    label: "Travail en équipe / familles / suivi / préparation APC",
    color: "peach",
    baseHoursAt100: 18,
  },
  { code: "108_pre_rentree", label: "Pré-rentrée", color: "cream", baseHoursAt100: 6 },
  { code: "108_journee_academique", label: "Journée académique", color: "lavender", baseHoursAt100: 6 },
  { code: "108_journee_solidarite", label: "Journée de solidarité", color: "cream", baseHoursAt100: 6 },
];

export const TOTAL_108H_AT_100 = HOURS_108_CATEGORIES.reduce(
  (sum, category) => sum + category.baseHoursAt100,
  0,
);

export function computePlannedMinutesForCategory(
  categoryCode: string,
  workQuotaPercentage: number,
): number {
  const category = HOURS_108_CATEGORIES.find((item) => item.code === categoryCode);
  if (!category) return 0;
  const ratio = Math.max(1, Math.min(100, workQuotaPercentage)) / 100;
  return Math.round(category.baseHoursAt100 * 60 * ratio);
}

export function computeTotalPlannedMinutes(workQuotaPercentage: number): number {
  return HOURS_108_CATEGORIES.reduce(
    (sum, category) => sum + computePlannedMinutesForCategory(category.code, workQuotaPercentage),
    0,
  );
}

export function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function getCategoryLabel(code: string): string {
  return HOURS_108_CATEGORIES.find((item) => item.code === code)?.label ?? code;
}

export function getCategoryColor(code: string): FloraAccent {
  return HOURS_108_CATEGORIES.find((item) => item.code === code)?.color ?? "lavender";
}
