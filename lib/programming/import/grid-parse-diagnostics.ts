import type { ProgrammationColumnField } from "./types";

export type GridParseMode = "sections" | "flat" | "none";

export type GridParseCandidate = {
  sheetName?: string;
  mode: GridParseMode;
  headerRowIndex: number;
  headerIndex: Partial<Record<ProgrammationColumnField, number>>;
  headers: string[];
  rowCount: number;
  confidence: number;
  rejectReason?: string;
  zone: {
    startRow: number;
    endRow: number;
    colCount: number;
  };
};

export type GridParseDiagnostics = {
  sheetName?: string;
  dimensions: { rows: number; cols: number; nonEmptyCells: number };
  zone: GridParseCandidate["zone"];
  mode: GridParseMode;
  headerRowIndex: number;
  headers: string[];
  headerIndex: Partial<Record<ProgrammationColumnField, number>>;
  confidence: number;
  rowCount: number;
  rejectReason?: string;
  candidates: GridParseCandidate[];
};

export function logGridParseDiagnostics(fileName: string, diagnostics: GridParseDiagnostics): void {
  console.info("[excel-grid-parse]", {
    fileName,
    sheet: diagnostics.sheetName ?? null,
    dimensions: diagnostics.dimensions,
    zone: diagnostics.zone,
    mode: diagnostics.mode,
    headerRowIndex: diagnostics.headerRowIndex,
    headers: diagnostics.headers.filter((header) => header.trim()).slice(0, 12),
    headerIndex: diagnostics.headerIndex,
    confidence: diagnostics.confidence,
    rowCount: diagnostics.rowCount,
    rejectReason: diagnostics.rejectReason ?? null,
    candidateCount: diagnostics.candidates.length,
    topCandidates: diagnostics.candidates.slice(0, 3).map((candidate) => ({
      sheet: candidate.sheetName ?? null,
      mode: candidate.mode,
      confidence: candidate.confidence,
      rowCount: candidate.rowCount,
      headerRowIndex: candidate.headerRowIndex,
      rejectReason: candidate.rejectReason ?? null,
    })),
  });
}
