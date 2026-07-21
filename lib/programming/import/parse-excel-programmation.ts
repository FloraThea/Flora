import "server-only";

import {
  buildExcelReadDiagnostics,
  logExcelReadDiagnostics,
  readExcelWorkbook,
  type ExcelReadDiagnostics,
} from "@/lib/import/read-excel-workbook";

export type ProgrammationWorkbookData = {
  sheetNames: string[];
  sheetName: string;
  grid: string[][];
  diagnostics: ExcelReadDiagnostics;
};

export function readProgrammationWorkbook(
  buffer: Buffer,
  fileName: string,
  preferredSheetName?: string,
): ProgrammationWorkbookData {
  const result = readExcelWorkbook(buffer, fileName, preferredSheetName);
  const diagnostics = buildExcelReadDiagnostics(result);
  logExcelReadDiagnostics(fileName, diagnostics);

  return {
    sheetNames: result.sheetNames,
    sheetName: result.activeSheetName,
    grid: result.grid,
    diagnostics,
  };
}
