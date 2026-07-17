import type {
  AcademicZone,
  ProgrammingCellContent,
  ProgrammationPayload,
  SchoolLevel,
  TimetableInput,
} from "@/lib/programming/types";
import { getDefaultSchoolYear } from "@/lib/programming/vacation-registry";

export type ProgrammationFormValues = {
  schoolYear: string;
  academicZone: AcademicZone;
  levels: SchoolLevel[];
  matiere: string;
  methode: string;
  projetAnnuel: string;
  timetable: TimetableInput;
};

export const MATIERE_OPTIONS = [
  "Français",
  "Mathématiques",
  "Questionner le monde",
  "Arts plastiques",
  "Éducation musicale",
  "EPS",
  "EMC",
  "Anglais",
  "Histoire des arts",
  "Toutes les matières",
] as const;

export const METHODE_OPTIONS = [
  "",
  "MHM",
  "Narramus",
  "ACCÈS",
  "Cap Maths",
  "Méthode Piano",
  "Taoki",
  "MHF",
  "Apprentilangue",
] as const;

export const EMPTY_TIMETABLE: TimetableInput = {
  slots: [],
  weeklyHoursBySubject: {},
};

export const DEFAULT_TIMETABLE: TimetableInput = EMPTY_TIMETABLE;

export { buildSchoolYearOptions, getDefaultSchoolYear } from "@/lib/programming/vacation-registry";

export const initialFormValues: ProgrammationFormValues = {
  schoolYear: getDefaultSchoolYear(),
  academicZone: "A",
  levels: ["CE2"],
  matiere: "Français",
  methode: "MHM",
  projetAnnuel: "",
  timetable: DEFAULT_TIMETABLE,
};

export type DragCellPayload = {
  tableKey: string;
  periodNumber: number;
  cell: ProgrammingCellContent;
};

export type ProgrammationViewState = {
  payload: ProgrammationPayload | null;
  isGenerating: boolean;
  error: string | null;
};
