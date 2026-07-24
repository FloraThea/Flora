import type { SourceDocument } from "@/lib/import/source-document";
import type { FloraAccent } from "@/lib/theme";

export const ACADEMIC_ZONES = ["A", "B", "C"] as const;
export type AcademicZone = (typeof ACADEMIC_ZONES)[number];

export const SCHOOL_LEVELS = ["CP", "CE1", "CE2", "CM1", "CM2"] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export const FRENCH_SUB_SUBJECTS = [
  "Lecture compréhension",
  "Lecture fluence",
  "Production d'écrits",
  "Écriture",
  "Orthographe",
  "Grammaire",
  "Conjugaison",
  "Vocabulaire",
  "Poésie",
] as const;

export const MATH_SUB_SUBJECTS = [
  "Nombres et calcul",
  "Calcul mental",
  "Résolution de problèmes",
  "Grandeurs et mesures",
  "Géométrie",
  "Organisation de données",
] as const;

export const OTHER_SUBJECTS = [
  "Questionner le monde",
  "Arts plastiques",
  "Éducation musicale",
  "EPS",
  "EMC",
  "Anglais",
  "Histoire des arts",
] as const;

export const MAIN_SUBJECTS = ["Français", "Mathématiques"] as const;
export type MainSubject = (typeof MAIN_SUBJECTS)[number];

export type TimetableSlot = {
  day: string;
  start: string;
  end: string;
  subject: string;
  hours: number;
};

export type TimetableInput = {
  slots: TimetableSlot[];
  weeklyHoursBySubject: Record<string, number>;
};

export type PublicHoliday = {
  date: string;
  label: string;
  isBridge?: boolean;
};

export type VacationPeriod = {
  id: string;
  label: string;
  start: string;
  end: string;
  zone: AcademicZone | "all";
};

export type SchoolWeek = {
  weekNumberInPeriod: number;
  weekNumberInYear: number;
  startDate: string;
  endDate: string;
  classDaysInWeek: number;
  teacherWorkingDaysInWeek: number;
  isPartial: boolean;
  publicHolidays: PublicHoliday[];
};

export type SchoolPeriod = {
  periodNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  /** Semaines de classe (cadre officiel — jours fériés non décomptés). */
  workingWeeks: number;
  classWeeks: number;
  workingDays: number;
  /** Jours réellement travaillés (profil enseignant, fériés, ponts). */
  effectiveWorkingDays: number;
  partialWeeks: number;
  publicHolidays: PublicHoliday[];
  schoolWeeks: SchoolWeek[];
};

export type CalendarSnapshot = {
  schoolYear: string;
  academicZone: AcademicZone;
  rentree: string;
  finAnnee: string;
  vacations: VacationPeriod[];
  publicHolidays: PublicHoliday[];
  bridgeDays: PublicHoliday[];
  periods: SchoolPeriod[];
  /** Total semaines de classe (objectif réglementaire : 36). */
  totalClassWeeks: number;
  totalWorkingWeeks: number;
  totalEffectiveWorkingDays: number;
  totalPartialWeeks: number;
  schoolWeeks: SchoolWeek[];
  teacherWorkingDays: string[];
};

export type ProgrammingCellContent = {
  id?: string;
  competences: string[];
  notions: string[];
  resources: string[];
  guides: string[];
  modules: string[];
  content: string;
  metadata?: Record<string, unknown>;
};

export type ProgrammingPeriodColumn = {
  id?: string;
  periodNumber: number;
  label: string;
  weekCount: number;
  startDate: string;
  endDate: string;
  cell: ProgrammingCellContent;
};

/** Vue synthétique d'un module / séquence dans la programmation annuelle. */
export type ProgrammationModuleSummary = {
  id: string;
  label: string;
  title?: string;
  periodNumber: number;
  startWeek?: number;
  sessionCount: number;
  seanceLabels?: string[];
  competences: string[];
  objectifs: string[];
  sourceDocumentId?: string;
  sourcePath?: string;
  importedRowId?: string;
};

export type ProgrammingTable = {
  id?: string;
  subjectKey: string;
  subjectLabel: string;
  subSubjectLabel: string;
  accent: FloraAccent;
  sortOrder: number;
  periods: ProgrammingPeriodColumn[];
  metadata?: Record<string, unknown>;
};

export type ProgrammingGenerationInput = {
  schoolYear: string;
  academicZone: AcademicZone;
  levels: SchoolLevel[];
  matiere: string;
  methode: string;
  projetAnnuel: string;
  timetable: TimetableInput;
  includeBridgeDays?: boolean;
  teacherWorkingDays?: string[];
};

export type ReferentielCompetence = {
  id: string;
  competence: string;
  code: string | null;
  discipline: string | null;
  domaine: string | null;
  niveau: string | null;
  section?: string | null;
  competenceType?: string | null;
  documentSourceId?: string | null;
};

export type ResourceContext = {
  documentId: string;
  title: string;
  matiere: string;
  methode: string;
  documentType: string;
  competences: string[];
  notions: string[];
  modules: string[];
};

export type PlannerContext = {
  referentiel: ReferentielCompetence[];
  resources: ResourceContext[];
  calendar: CalendarSnapshot;
  timetable: TimetableInput;
  boDocumentId?: string | null;
};

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  tableKey?: string;
  periodNumber?: number;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    totalCompetences: number;
    coveredCompetences: number;
    duplicateCount: number;
    unusedWeeks: number;
    loadBalanceScore: number;
  };
};

export type StoredProgrammation = {
  id: string;
  title: string;
  school_year: string;
  academic_zone: AcademicZone;
  levels: string[];
  matiere: string;
  methode: string;
  projet_annuel: string;
  timetable: TimetableInput;
  calendar_snapshot: CalendarSnapshot;
  validation: ValidationResult;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProgrammationPayload = {
  programmation: StoredProgrammation;
  tables: ProgrammingTable[];
  validation: ValidationResult;
  sourceDocument?: SourceDocument | null;
  sourceType?: string;
};
