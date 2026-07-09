import type { SchoolLevel, TimetableInput } from "@/lib/programming/types";
import { buildSchoolYearOptions, DEFAULT_TIMETABLE } from "@/app/programmation/types";
import {
  DEFAULT_TEACHER_WORKING_DAYS,
  detectWorkQuotaPreset,
} from "@/lib/profile/work-schedule";
import type {
  ClassType,
  ProfilFormValues,
  TeacherProject,
  TimetableEntry,
} from "@/lib/profile/types";

export const SCHOOL_LEVELS: SchoolLevel[] = ["CP", "CE1", "CE2", "CM1", "CM2"];

export function createTimetableEntry(
  name: string,
  timetable: TimetableInput = DEFAULT_TIMETABLE,
): TimetableEntry {
  return {
    id: `edt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    timetable,
  };
}

export const initialProfilValues: ProfilFormValues = (() => {
  const defaultEntry = createTimetableEntry("Emploi du temps principal", DEFAULT_TIMETABLE);

  return {
    nom: "",
    prenom: "",
    ecoleNom: "",
    commune: "",
    academie: "",
    zoneScolaire: "A",
    pays: "France",
    schoolYear: buildSchoolYearOptions()[1] ?? "2025-2026",
    levels: ["CE2"],
    studentCount: 25,
    classType: "simple",
    ulis: false,
    segpa: false,
    rep: false,
    repPlus: false,
    workQuotaPercentage: 100,
    workQuotaLabel: "100 %",
    workQuotaPreset: detectWorkQuotaPreset(100),
    workingDays: [...DEFAULT_TEACHER_WORKING_DAYS],
    timetables: [defaultEntry],
    defaultTimetableId: defaultEntry.id,
    methods: ["MHM"],
    primaryMethod: "MHM",
    pedagogyStyles: ["explicite"],
    projects: [],
    resourcePriorities: ["bo", "guides", "ressources_importees"],
    aiDetailLevel: "moyen",
    aiTone: "simple",
    aiGenerationType: "equilibree",
    personalization: {
      accentColor: "rose",
      fontStyle: "mix",
      logoUrl: "",
      className: "",
      schoolName: "",
      signature: "",
    },
    exportFormats: ["word", "pdf"],
    exportOrder: ["word", "pdf", "excel"],
  };
})();

export function ensureDefaultTimetableId(values: ProfilFormValues): ProfilFormValues {
  if (values.defaultTimetableId || values.timetables.length === 0) {
    return values;
  }

  return {
    ...values,
    defaultTimetableId: values.timetables[0].id,
  };
}

export function emptyProject(projectType: TeacherProject["projectType"]): TeacherProject {
  return {
    projectType,
    title: "",
    description: "",
    sortOrder: 0,
  };
}

export const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20";

export const labelClassName =
  "mb-2 block text-[11px] font-medium tracking-[0.12em] text-[#b5ada5] uppercase";

export const CLASS_TYPE_OPTIONS: { value: ClassType; label: string }[] = [
  { value: "simple", label: "Simple niveau" },
  { value: "double", label: "Double niveau" },
  { value: "triple", label: "Triple niveau" },
  { value: "quadruple", label: "Quadruple niveau" },
  { value: "flexible", label: "Classe flexible" },
];
