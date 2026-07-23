import "server-only";

import {
  buildExcelReadDiagnostics,
  logExcelReadDiagnostics,
  readAllWorkbookSheets,
  type ExcelReadDiagnostics,
} from "@/lib/import/read-excel-workbook";
import { parseBestSheetGrid } from "./grid-parser";
import type { GridParseDiagnostics } from "./grid-parse-diagnostics";

export type ProgrammationWorkbookData = {
  sheetNames: string[];
  sheetName: string;
  grid: string[][];
  diagnostics: ExcelReadDiagnostics;
  gridParseDiagnostics: GridParseDiagnostics;
};

export function readProgrammationWorkbook(
  buffer: Buffer,
  fileName: string,
  preferredSheetName?: string,
): ProgrammationWorkbookData {
  const workbook = readAllWorkbookSheets(buffer, fileName);
  const sheets =
    preferredSheetName && workbook.sheetNames.includes(preferredSheetName)
      ? workbook.sheets.filter((sheet) => sheet.sheetName === preferredSheetName)
      : workbook.sheets;

  const parsed = parseBestSheetGrid(
    sheets.map((sheet) => ({ sheetName: sheet.sheetName, grid: sheet.grid })),
  );
  const activeSheetStats =
    workbook.sheets.find((sheet) => sheet.sheetName === parsed.sheetName)?.stats ??
    workbook.sheets[0]?.stats;

  const diagnostics: ExcelReadDiagnostics = {
    sheetCount: workbook.sheetNames.length,
    activeSheet: parsed.sheetName,
    rowCount: activeSheetStats?.rowCount ?? 0,
    colCount: activeSheetStats?.colCount ?? 0,
    nonEmptyCells: activeSheetStats?.nonEmptyCells ?? 0,
    mergeCount: activeSheetStats?.mergeCount ?? 0,
    rejectReason: parsed.diagnostics.rejectReason,
  };

  logExcelReadDiagnostics(fileName, diagnostics);

  return {
    sheetNames: workbook.sheetNames,
    sheetName: parsed.sheetName,
    grid: sheets.find((sheet) => sheet.sheetName === parsed.sheetName)?.grid ?? sheets[0]?.grid ?? [],
    diagnostics,
    gridParseDiagnostics: parsed.diagnostics,
  };
}
