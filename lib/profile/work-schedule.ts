import type { TimetableInput } from "@/lib/programming/types";
import { normalizeDayName } from "@/lib/journal/date-utils";

export const TEACHER_WORKING_DAY_OPTIONS = [
  { value: "Lundi", label: "Lundi" },
  { value: "Mardi", label: "Mardi" },
  { value: "Mercredi", label: "Mercredi" },
  { value: "Jeudi", label: "Jeudi" },
  { value: "Vendredi", label: "Vendredi" },
  { value: "Samedi", label: "Samedi" },
] as const;

export type TeacherWorkingDay = (typeof TEACHER_WORKING_DAY_OPTIONS)[number]["value"];

export const DEFAULT_TEACHER_WORKING_DAYS: TeacherWorkingDay[] = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
];

export const WORK_QUOTA_PRESETS = [
  { value: "100", label: "100 %", percentage: 100 },
  { value: "80", label: "80 %", percentage: 80 },
  { value: "75", label: "75 %", percentage: 75 },
  { value: "50", label: "Mi-temps / 50 %", percentage: 50 },
  { value: "custom", label: "Autre quotité personnalisée", percentage: null },
] as const;

export type WorkQuotaPreset = (typeof WORK_QUOTA_PRESETS)[number]["value"];

export function normalizeWorkingDays(days: string[] | null | undefined): TeacherWorkingDay[] {
  if (!days || days.length === 0) {
    return [...DEFAULT_TEACHER_WORKING_DAYS];
  }

  const allowed = new Set(TEACHER_WORKING_DAY_OPTIONS.map((day) => day.value));
  const normalized = days
    .map((day) => {
      const match = TEACHER_WORKING_DAY_OPTIONS.find(
        (option) => normalizeDayName(option.value) === normalizeDayName(day),
      );
      return match?.value ?? null;
    })
    .filter((day): day is TeacherWorkingDay => Boolean(day && allowed.has(day)));

  return normalized.length > 0 ? normalized : [...DEFAULT_TEACHER_WORKING_DAYS];
}

export function suggestWorkingDaysForQuota(percentage: number): TeacherWorkingDay[] {
  if (percentage >= 100) return [...DEFAULT_TEACHER_WORKING_DAYS];
  if (percentage >= 80) return ["Lundi", "Mardi", "Mercredi", "Jeudi"];
  if (percentage >= 75) return ["Lundi", "Mardi", "Mercredi", "Jeudi"];
  if (percentage >= 50) return ["Lundi", "Mercredi"];
  if (percentage >= 40) return ["Mardi", "Jeudi"];
  return ["Lundi"];
}

export function resolveWorkQuotaLabel(percentage: number, preset?: WorkQuotaPreset): string {
  if (preset && preset !== "custom") {
    const presetMatch = WORK_QUOTA_PRESETS.find((item) => item.value === preset);
    if (presetMatch) return presetMatch.label;
  }

  const exactMatch = WORK_QUOTA_PRESETS.find(
    (item) => item.percentage === percentage,
  );
  if (exactMatch && exactMatch.value !== "custom") {
    return exactMatch.label;
  }

  return `${percentage} %`;
}

export function detectWorkQuotaPreset(percentage: number): WorkQuotaPreset {
  const match = WORK_QUOTA_PRESETS.find((item) => item.percentage === percentage);
  return match?.value ?? "custom";
}

export function clampWorkQuotaPercentage(value: number): number {
  return Math.min(100, Math.max(1, Math.round(value)));
}

export function isDateOnWorkingDays(workingDays: string[], date: string): boolean {
  const normalized = normalizeWorkingDays(workingDays);
  const dateObj = new Date(`${date}T12:00:00`);
  const frenchDays = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const dayName = frenchDays[dateObj.getDay()] ?? "";
  return normalized.some((day) => normalizeDayName(day) === dayName);
}

export function getSchoolDaysFromWorkingDays(workingDays: string[]): string[] {
  return normalizeWorkingDays(workingDays);
}

export function filterTimetableByWorkingDays(
  timetable: TimetableInput,
  workingDays: string[],
): TimetableInput {
  const allowed = new Set(normalizeWorkingDays(workingDays).map((day) => normalizeDayName(day)));

  const slots = timetable.slots.filter((slot) => allowed.has(normalizeDayName(slot.day)));

  const weeklyHoursBySubject: Record<string, number> = {};
  for (const slot of slots) {
    weeklyHoursBySubject[slot.subject] =
      (weeklyHoursBySubject[slot.subject] ?? 0) + (slot.hours ?? 1);
  }

  return {
    ...timetable,
    slots,
    weeklyHoursBySubject,
  };
}
