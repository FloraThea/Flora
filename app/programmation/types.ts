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

export const DEFAULT_TIMETABLE: TimetableInput = {
  slots: [
    { day: "Lundi", start: "08:30", end: "10:30", subject: "Français", hours: 2 },
    { day: "Lundi", start: "10:45", end: "11:45", subject: "Mathématiques", hours: 1 },
    { day: "Mardi", start: "08:30", end: "10:30", subject: "Français", hours: 2 },
    { day: "Mercredi", start: "08:30", end: "09:30", subject: "Questionner le monde", hours: 1 },
    { day: "Jeudi", start: "08:30", end: "09:30", subject: "Mathématiques", hours: 1 },
    { day: "Vendredi", start: "08:30", end: "09:30", subject: "Arts plastiques", hours: 1 },
  ],
  weeklyHoursBySubject: {
    Français: 4,
    Mathématiques: 2,
    "Questionner le monde": 1,
    "Arts plastiques": 1,
  },
};

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
