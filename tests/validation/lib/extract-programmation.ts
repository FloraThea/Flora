import fs from "node:fs";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import { readExcelGrid } from "./read-excel-grid";
import {
  buildProgrammationStats,
  normalizeProgrammationRow,
  type ProgrammationValidationSnapshot,
  type ProgressionValidationSnapshot,
  type SpreadsheetValidationSnapshotBase,
} from "./snapshot-types";

export function extractProgrammationSnapshot(
  buffer: Buffer,
  fileName: string,
  kind: "programmation" | "progression",
): ProgrammationValidationSnapshot | ProgressionValidationSnapshot {
  const workbook = readExcelGrid(buffer, fileName);
  const parsed = rowsFromGrid(workbook.grid, undefined, { sourceSheet: workbook.sheetName });
  const warnings: string[] = [];

  if (parsed.rows.length === 0) {
    warnings.push("Aucune ligne structurée détectée.");
  }
  if (Object.keys(parsed.headerIndex).length < 2) {
    warnings.push("En-têtes peu détectés — mapping manuel peut être requis.");
  }

  const base = {
    fileName,
    sheetName: workbook.sheetName,
    sheetNames: workbook.sheetNames,
    sourceCellCount: workbook.sourceCells.length,
    sourceCells: workbook.sourceCells,
    headerRowIndex: parsed.headerRowIndex,
    columns: parsed.headers,
    stats: buildProgrammationStats(parsed.rows),
    rows: parsed.rows.map(normalizeProgrammationRow),
    warnings,
    needsColumnMapping: Object.keys(parsed.headerIndex).length < 2,
  } satisfies SpreadsheetValidationSnapshotBase;

  if (kind === "progression") {
    const snapshot: ProgressionValidationSnapshot = {
      kind: "progression",
      ...base,
    };
    return snapshot;
  }

  const snapshot: ProgrammationValidationSnapshot = {
    kind: "programmation",
    ...base,
  };
  return snapshot;
}

export function loadProgrammationSnapshot(filePath: string, kind: "programmation" | "progression") {
  const buffer = fs.readFileSync(filePath);
  return extractProgrammationSnapshot(buffer, filePath.split("/").pop() ?? filePath, kind);
}
