import type { FloraAccent } from "@/lib/theme";

export type Hours108CategoryDefinition = {
  code: string;
  label: string;
  color: FloraAccent;
  /** Heures annualisées à temps plein (100 %). */
  baseHoursAt100: number;
  /** Groupe réglementaire pour l'affichage. */
  group: "besoins_eleves" | "conseils_institutionnels" | "animations" | "conseils_ecole";
};

/**
 * Répartition officielle des 108 h annualisées (hors temps de classe) à temps plein.
 * 36 + 24 + 24 + 18 + 6 = 108 h
 *
 * 60 h besoins des élèves : 36 h APC + 24 h forfait (besoins, prépa APC, projets intercycles)
 * 24 h forfait : conseils des maîtres, conseils de cycle, relations parents
 * 18 h animations pédagogiques (formation continue)
 * 6 h conseils d'école
 */
export const HOURS_108_CATEGORIES: Hours108CategoryDefinition[] = [
  {
    code: "108_apc",
    label: "Activités pédagogiques complémentaires (APC)",
    color: "lavender",
    baseHoursAt100: 36,
    group: "besoins_eleves",
  },
  {
    code: "108_prep_apc",
    label: "Besoins des élèves, préparation APC et projets intercycles",
    color: "cream",
    baseHoursAt100: 24,
    group: "besoins_eleves",
  },
  {
    code: "108_conseils_maitres",
    label: "Conseils des maîtres, conseils de cycle et relations avec les parents",
    color: "peach",
    baseHoursAt100: 24,
    group: "conseils_institutionnels",
  },
  {
    code: "108_animations",
    label: "Animations pédagogiques (formation continue)",
    color: "sage",
    baseHoursAt100: 18,
    group: "animations",
  },
  {
    code: "108_conseils",
    label: "Conseils d'école",
    color: "rose",
    baseHoursAt100: 6,
    group: "conseils_ecole",
  },
];

/** Anciennes catégories supprimées de la répartition réglementaire (126 h erronées). */
const DEPRECATED_CATEGORY_CODES = new Set([
  "108_equipe_familles",
  "108_pre_rentree",
  "108_journee_academique",
  "108_journee_solidarite",
]);

/** Répartition exacte par quotité (source : réglementation / UNSA). */
export type Hours108QuotaPreset = {
  percentage: number;
  label: string;
  totalHours: number;
  categories: Record<string, number>;
};

export const HOURS_108_QUOTA_PRESETS: Hours108QuotaPreset[] = [
  {
    percentage: 100,
    label: "100 %",
    totalHours: 108,
    categories: {
      "108_apc": 36,
      "108_prep_apc": 24,
      "108_conseils_maitres": 24,
      "108_animations": 18,
      "108_conseils": 6,
    },
  },
  {
    percentage: 80,
    label: "80 %",
    totalHours: 87,
    categories: {
      "108_apc": 29,
      "108_prep_apc": 19,
      "108_conseils_maitres": 19.25,
      "108_animations": 14.5,
      "108_conseils": 5.25,
    },
  },
  {
    percentage: 75,
    label: "75 %",
    totalHours: 81,
    categories: {
      "108_apc": 27,
      "108_prep_apc": 18,
      "108_conseils_maitres": 18,
      "108_animations": 13.5,
      "108_conseils": 4.5,
    },
  },
  {
    percentage: 50,
    label: "50 %",
    totalHours: 54,
    categories: {
      "108_apc": 18,
      "108_prep_apc": 12,
      "108_conseils_maitres": 12,
      "108_animations": 9,
      "108_conseils": 3,
    },
  },
  {
    percentage: 33,
    label: "M2 alternants",
    totalHours: 36,
    categories: {
      "108_apc": 12,
      "108_prep_apc": 8,
      "108_conseils_maitres": 8,
      "108_animations": 6,
      "108_conseils": 2,
    },
  },
];

export const TOTAL_108H_AT_100 = HOURS_108_CATEGORIES.reduce(
  (sum, category) => sum + category.baseHoursAt100,
  0,
);

/** Remappe les anciens codes vers la nouvelle répartition. */
export function normalizeLegacyCategoryCode(categoryCode: string): string {
  if (categoryCode === "108_equipe_familles") return "108_conseils_maitres";
  if (DEPRECATED_CATEGORY_CODES.has(categoryCode)) return categoryCode;
  return categoryCode;
}

export function isActive108CategoryCode(categoryCode: string): boolean {
  const normalized = normalizeLegacyCategoryCode(categoryCode);
  return HOURS_108_CATEGORIES.some((item) => item.code === normalized);
}

function resolveQuotaPreset(workQuotaPercentage: number): Hours108QuotaPreset | null {
  const rounded = Math.round(workQuotaPercentage);
  const exact = HOURS_108_QUOTA_PRESETS.find((preset) => preset.percentage === rounded);
  if (exact) return exact;

  if (rounded >= 32 && rounded <= 34) {
    return HOURS_108_QUOTA_PRESETS.find((preset) => preset.percentage === 33) ?? null;
  }

  return null;
}

export function computeTotalHoursForQuota(workQuotaPercentage: number): number {
  const preset = resolveQuotaPreset(workQuotaPercentage);
  if (preset) return preset.totalHours;
  return Math.round(TOTAL_108H_AT_100 * (Math.max(1, Math.min(100, workQuotaPercentage)) / 100));
}

export function computePlannedMinutesForCategory(
  categoryCode: string,
  workQuotaPercentage: number,
): number {
  const normalized = normalizeLegacyCategoryCode(categoryCode);
  const category = HOURS_108_CATEGORIES.find((item) => item.code === normalized);
  if (!category) return 0;

  const preset = resolveQuotaPreset(workQuotaPercentage);
  if (preset?.categories[normalized] !== undefined) {
    return Math.round(preset.categories[normalized] * 60);
  }

  const ratio = Math.max(1, Math.min(100, workQuotaPercentage)) / 100;
  return Math.round(category.baseHoursAt100 * 60 * ratio);
}

export function computeTotalPlannedMinutes(workQuotaPercentage: number): number {
  const preset = resolveQuotaPreset(workQuotaPercentage);
  if (preset) return Math.round(preset.totalHours * 60);

  return HOURS_108_CATEGORIES.reduce(
    (sum, category) => sum + computePlannedMinutesForCategory(category.code, workQuotaPercentage),
    0,
  );
}

export function aggregateCompletedMinutesByCategory(
  entries: Array<{ category_code: unknown; duration_minutes: unknown }>,
): Map<string, number> {
  const completedByCategory = new Map<string, number>();

  for (const row of entries) {
    const rawCode = String(row.category_code);
    const normalized = normalizeLegacyCategoryCode(rawCode);
    if (!HOURS_108_CATEGORIES.some((item) => item.code === normalized)) continue;

    completedByCategory.set(
      normalized,
      (completedByCategory.get(normalized) ?? 0) + Number(row.duration_minutes ?? 0),
    );
  }

  return completedByCategory;
}

export function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins.toString().padStart(2, "0")} min`;
}

export function formatHoursDecimal(hours: number): string {
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (mins === 0) return `${whole} h`;
  return `${whole} h ${mins.toString().padStart(2, "0")} min`;
}

export function getCategoryLabel(code: string): string {
  const normalized = normalizeLegacyCategoryCode(code);
  return HOURS_108_CATEGORIES.find((item) => item.code === normalized)?.label ?? code;
}

export function getCategoryColor(code: string): FloraAccent {
  const normalized = normalizeLegacyCategoryCode(code);
  return HOURS_108_CATEGORIES.find((item) => item.code === normalized)?.color ?? "lavender";
}

export function getBesoinsElevesPlannedMinutes(workQuotaPercentage: number): number {
  return (
    computePlannedMinutesForCategory("108_apc", workQuotaPercentage) +
    computePlannedMinutesForCategory("108_prep_apc", workQuotaPercentage)
  );
}
