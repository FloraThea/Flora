import type { SourceDocument } from "@/lib/import/source-document";
import type { AcademicZone, CalendarSnapshot, ProgrammingTable, SchoolLevel } from "../types";
import type { ProgrammationImportBatchMeta } from "./batch-types";

export type ProgrammationImportFormat = "pdf" | "word" | "excel" | "csv" | "text" | "image";

export type ProgrammationColumnField =
  | "period"
  | "week"
  | "date"
  | "day"
  | "discipline"
  | "niveau"
  | "sequence"
  | "seance"
  | "objectif"
  | "competence"
  | "notion"
  | "materiel"
  | "ressource"
  | "remarques"
  | "deroulement"
  | "evaluation"
  | "differenciation"
  | "domaine";

export type ImportedProgrammationRow = {
  id: string;
  periodNumber: number | null;
  weekNumber: number | null;
  weekLabel: string;
  calendarDate: string | null;
  dayOfWeek: string | null;
  discipline: string;
  niveau: string;
  sequence: string;
  seance: string;
  objectif: string;
  competences: string[];
  notions: string[];
  materiel: string[];
  ressources: string[];
  remarques: string;
  deroulement: string;
  evaluation: string;
  differenciation: string;
  domaine: string;
  rawLine: string;
  sourceSheet?: string;
  sourceRowIndex?: number;
  rawCells?: string[];
  parseConfidence?: number;
  parseNotes?: string[];
};

export type ParsedProgrammationImport = {
  format: ProgrammationImportFormat;
  fileName: string;
  discipline: string;
  niveau: string;
  rows: ImportedProgrammationRow[];
  warnings: string[];
  extractedTextPreview: string;
  sheetNames?: string[];
  sheetName?: string;
  columns: string[];
  previewRows: string[][];
  rowCount: number;
  needsColumnMapping: boolean;
  detectedFields: Partial<Record<ProgrammationColumnField, string>>;
  columnMapping?: Partial<Record<ProgrammationColumnField, number>>;
  headerRowIndex?: number;
  sourceGrid?: string[][];
  /** Copie fidèle complète du fichier — source de vérité pour l'affichage. */
  sourceDocument?: SourceDocument;
  batchMeta?: ProgrammationImportBatchMeta;
};

export type AdaptationStrategy =
  | "spread"
  | "condense"
  | "shift"
  | "merge"
  | "add_revision";

export type AdaptationConflict = {
  code: string;
  message: string;
  severity: "warning" | "error";
};

export type AdaptationPlan = {
  sourceWeekCount: number;
  targetWeekCount: number;
  strategy: AdaptationStrategy;
  strategiesApplied: AdaptationStrategy[];
  conflicts: AdaptationConflict[];
  suggestions: string[];
};

export type CompetencyMatchResult = {
  importedLabel: string;
  referentielId: string | null;
  matchedLabel: string;
  confidence: number;
  status: "matched" | "fuzzy" | "missing" | "manual";
};

export type ProgrammationFormatColumn =
  | "period"
  | "week"
  | "dates"
  | "discipline"
  | "domaine"
  | "sequence"
  | "seance"
  | "competence_bo"
  | "objectif"
  | "deroulement"
  | "materiel"
  | "ressource"
  | "differenciation"
  | "evaluation";

export type ProgrammationFormatConfig = {
  columns: ProgrammationFormatColumn[];
  periodColors: Record<number, string>;
  disciplineColors: Record<string, string>;
  layout: "table" | "print";
  exportFormats: Array<"word" | "pdf" | "excel">;
};

export const DEFAULT_FORMAT_COLUMNS: ProgrammationFormatColumn[] = [
  "period",
  "week",
  "dates",
  "discipline",
  "seance",
  "competence_bo",
  "objectif",
  "materiel",
  "ressource",
];

export const DEFAULT_FORMAT_CONFIG: ProgrammationFormatConfig = {
  columns: DEFAULT_FORMAT_COLUMNS,
  periodColors: {
    1: "#d4e0cc",
    2: "#e8dff0",
    3: "#f5e6dc",
    4: "#dce8f0",
    5: "#f0e8dc",
  },
  disciplineColors: {},
  layout: "table",
  exportFormats: ["word", "pdf", "excel"],
};

export type ProgrammationImportSession = {
  parsed: ParsedProgrammationImport;
  adaptation: AdaptationPlan;
  calendar: CalendarSnapshot;
  competencyMatches: CompetencyMatchResult[];
  formatConfig: ProgrammationFormatConfig;
  tables: ProgrammingTable[];
  schoolYear: string;
  academicZone: AcademicZone;
  levels: SchoolLevel[];
  matiere: string;
};
