import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import type { TimetableImportSession } from "@/lib/timetable/import/types";

export type SpreadsheetValidationSnapshotBase = {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  sourceCellCount: number;
  sourceCells: Array<{ row: number; col: number; value: string }>;
  headerRowIndex: number;
  columns: string[];
  stats: {
    dataRowCount: number;
    parsedRowCount: number;
    periodCount: number;
    weekCount: number;
    dateCount: number;
    dayCount: number;
    sequenceCount: number;
    seanceCount: number;
    disciplineCount: number;
  };
  rows: Array<{
    sourceRowIndex: number | null;
    sourceSheet: string | null;
    calendarDate: string | null;
    dayOfWeek: string | null;
    periodNumber: number | null;
    weekNumber: number | null;
    discipline: string;
    sequence: string;
    seance: string;
    objectif: string;
    competences: string[];
    materiel: string[];
    rawCells: string[];
    parseConfidence: number | null;
    parseNotes: string[] | null;
  }>;
  warnings: string[];
  needsColumnMapping: boolean;
};

export type ProgrammationValidationSnapshot = SpreadsheetValidationSnapshotBase & {
  kind: "programmation";
};

export type ProgressionValidationSnapshot = SpreadsheetValidationSnapshotBase & {
  kind: "progression";
};

export type TimetableValidationSnapshot = {
  kind: "emploi_du_temps";
  fileName: string;
  sheetName: string;
  className: string;
  schoolYear: string;
  days: string[];
  stats: {
    sessionCount: number;
    withComplementaryText: number;
    withSubSubject: number;
    uniqueSubjects: number;
    mergedCellCount: number;
  };
  sessions: Array<{
    day: string;
    startTime: string;
    endTime: string;
    subject: string;
    subSubject: string;
    customText: string;
    color: string;
    rawLabel: string;
    rowIndex: number;
    colIndex: number;
  }>;
  exportLines: string[];
  displayChecks: {
    complementaryVisible: boolean;
    duplicatePreservesComplementary: boolean;
  };
  warnings: string[];
  needsManualStructure: boolean;
};

export type GuideValidationSnapshot = {
  kind: "guides_maitre";
  fileName: string;
  documentType: string;
  methodDetected: string;
  stats: {
    textLength: number;
    pageCount: number | null;
    competenceMatches: number;
    objectifMatches: number;
    deroulementMatches: number;
    materielMatches: number;
    ressourceMatches: number;
  };
  preview: string;
  keywordsFound: string[];
  warnings: string[];
};

export type ValidationSnapshot =
  | ProgrammationValidationSnapshot
  | ProgressionValidationSnapshot
  | TimetableValidationSnapshot
  | GuideValidationSnapshot;

export function normalizeProgrammationRow(row: ImportedProgrammationRow) {
  return {
    sourceRowIndex: row.sourceRowIndex ?? null,
    sourceSheet: row.sourceSheet ?? null,
    calendarDate: row.calendarDate,
    dayOfWeek: row.dayOfWeek,
    periodNumber: row.periodNumber,
    weekNumber: row.weekNumber,
    discipline: row.discipline,
    sequence: row.sequence,
    seance: row.seance,
    objectif: row.objectif,
    competences: [...row.competences],
    materiel: [...row.materiel],
    rawCells: [...(row.rawCells ?? [])],
    parseConfidence: row.parseConfidence ?? null,
    parseNotes: row.parseNotes ?? null,
  };
}

export function buildProgrammationStats(rows: ImportedProgrammationRow[]) {
  const unique = <T,>(values: T[]) => [...new Set(values.filter(Boolean))];
  return {
    dataRowCount: rows.length,
    parsedRowCount: rows.length,
    periodCount: unique(rows.map((r) => r.periodNumber)).length,
    weekCount: unique(rows.map((r) => r.weekNumber)).length,
    dateCount: unique(rows.map((r) => r.calendarDate)).length,
    dayCount: unique(rows.map((r) => r.dayOfWeek)).length,
    sequenceCount: unique(rows.map((r) => r.sequence)).length,
    seanceCount: unique(rows.map((r) => r.seance)).length,
    disciplineCount: unique(rows.map((r) => r.discipline)).length,
  };
}

export function normalizeTimetableSession(session: TimetableImportSession) {
  return {
    day: session.day,
    startTime: session.startTime,
    endTime: session.endTime,
    subject: session.subject,
    subSubject: session.subSubject ?? session.title ?? "",
    customText: session.customText ?? session.notes ?? "",
    color: session.color,
    rawLabel: session.rawLabel,
    rowIndex: session.rowIndex,
    colIndex: session.colIndex,
  };
}
