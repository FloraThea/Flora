import type { AcademicZone, SchoolLevel, TimetableInput } from "@/lib/programming/types";
import type { FloraAccent } from "@/lib/theme";
import type { TeacherWorkingDay, WorkQuotaPreset } from "./work-schedule";

export const CLASS_TYPES = [
  "simple",
  "double",
  "triple",
  "quadruple",
  "flexible",
] as const;
export type ClassType = (typeof CLASS_TYPES)[number];

export const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  simple: "Simple niveau",
  double: "Double niveau",
  triple: "Triple niveau",
  quadruple: "Quadruple niveau",
  flexible: "Classe flexible",
};

export const PROFILE_METHOD_OPTIONS = [
  "MHM",
  "Cap Maths",
  "Taoki",
  "Narramus",
  "Accès",
  "Piano",
  "Retz",
  "MHF",
  "Méthode personnelle",
] as const;

export const PEDAGOGY_STYLE_OPTIONS = [
  { value: "explicite", label: "Pédagogie explicite" },
  { value: "montessori", label: "Montessori" },
  { value: "freinet", label: "Freinet" },
  { value: "manipulation", label: "Manipulation" },
  { value: "classe_flexible", label: "Classe flexible" },
  { value: "cooperative", label: "Coopérative" },
  { value: "traditionnelle", label: "Traditionnelle" },
  { value: "mixte", label: "Mixte" },
] as const;

export const RESOURCE_PRIORITY_OPTIONS = [
  { value: "bo", label: "BO" },
  { value: "guides", label: "Guides" },
  { value: "albums", label: "Albums" },
  { value: "documents_personnels", label: "Documents personnels" },
  { value: "internet", label: "Internet" },
  { value: "ressources_importees", label: "Ressources importées" },
] as const;

export const AI_DETAIL_LEVELS = ["court", "moyen", "tres_detaille"] as const;
export type AiDetailLevel = (typeof AI_DETAIL_LEVELS)[number];

export const AI_TONES = ["institutionnelle", "simple", "tres_pedagogique"] as const;
export type AiTone = (typeof AI_TONES)[number];

export const AI_GENERATION_TYPES = ["rapide", "equilibree", "tres_approfondie"] as const;
export type AiGenerationType = (typeof AI_GENERATION_TYPES)[number];

export const EXPORT_FORMAT_OPTIONS = [
  { value: "word", label: "Word" },
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
] as const;

export const PROJECT_TYPES = [
  "annuel",
  "periode",
  "sortie",
  "intervenant",
  "theme",
] as const;
export type TeacherProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<TeacherProjectType, string> = {
  annuel: "Projet annuel",
  periode: "Projet de période",
  sortie: "Sorties",
  intervenant: "Intervenants",
  theme: "Thème annuel",
};

export type TimetableEntry = {
  id: string;
  name: string;
  timetable: TimetableInput;
};

export type PersonalizationSettings = {
  accentColor: FloraAccent;
  fontStyle: "serif" | "sans" | "mix";
  logoUrl: string;
  className: string;
  schoolName: string;
  signature: string;
};

export type TeacherMethod = {
  id?: string;
  methodName: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type TeacherProject = {
  id?: string;
  projectType: TeacherProjectType;
  title: string;
  description: string;
  sortOrder: number;
};

export type StoredTeacherProfile = {
  id: string;
  nom: string;
  prenom: string;
  ecoleNom: string;
  commune: string;
  academie: string;
  zoneScolaire: AcademicZone;
  pays: string;
  schoolYear: string;
  levels: SchoolLevel[];
  studentCount: number;
  classType: ClassType;
  ulis: boolean;
  segpa: boolean;
  rep: boolean;
  repPlus: boolean;
  workQuotaPercentage: number;
  workQuotaLabel: string;
  workingDays: TeacherWorkingDay[];
  timetables: TimetableEntry[];
  defaultTimetableId: string;
  personalization: PersonalizationSettings;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoredTeacherPreferences = {
  id: string;
  profileId: string;
  pedagogyStyles: string[];
  resourcePriorities: string[];
  aiDetailLevel: AiDetailLevel;
  aiTone: AiTone;
  aiGenerationType: AiGenerationType;
  exportFormats: string[];
  exportOrder: string[];
};

export type TeacherProfileBundle = {
  profile: StoredTeacherProfile;
  preferences: StoredTeacherPreferences;
  methods: TeacherMethod[];
  projects: TeacherProject[];
};

export type ProfilFormValues = {
  nom: string;
  prenom: string;
  ecoleNom: string;
  commune: string;
  academie: string;
  zoneScolaire: AcademicZone;
  pays: string;
  schoolYear: string;
  levels: SchoolLevel[];
  studentCount: number;
  classType: ClassType;
  ulis: boolean;
  segpa: boolean;
  rep: boolean;
  repPlus: boolean;
  workQuotaPercentage: number;
  workQuotaLabel: string;
  workQuotaPreset: WorkQuotaPreset;
  workingDays: TeacherWorkingDay[];
  timetables: TimetableEntry[];
  defaultTimetableId: string;
  methods: string[];
  primaryMethod: string;
  pedagogyStyles: string[];
  projects: TeacherProject[];
  resourcePriorities: string[];
  aiDetailLevel: AiDetailLevel;
  aiTone: AiTone;
  aiGenerationType: AiGenerationType;
  personalization: PersonalizationSettings;
  exportFormats: string[];
  exportOrder: string[];
};

export type ProfilSaveInput = ProfilFormValues;

export type ProfilCompletionStatus = {
  complete: boolean;
  missing: string[];
};
