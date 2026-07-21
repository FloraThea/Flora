import * as XLSX from "xlsx";
import { readExcelWorkbook } from "@/lib/import/read-excel-workbook";

export type MergeRegion = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

export type GridWorkbook = {
  sheetName: string;
  grid: string[][];
  merges: MergeRegion[];
  rangeOffset: { row: number; col: number };
};

export function readWorkbookGrid(buffer: Buffer, fileName: string): GridWorkbook {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0] ?? "csv";
    const sheet = workbook.Sheets[sheetName];
    const ref = sheet?.["!ref"];
    if (!ref) {
      return { sheetName, grid: [], merges: [], rangeOffset: { row: 0, col: 0 } };
    }
    const range = XLSX.utils.decode_range(ref);
    const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }).map((row) =>
      row.map((cell) => String(cell ?? "").trim()),
    );
    return { sheetName, grid, merges: [], rangeOffset: { row: range.s.r, col: range.s.c } };
  }

  const result = readExcelWorkbook(buffer, fileName);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false, cellText: true });
  const sheet = workbook.Sheets[result.activeSheetName];
  const ref = sheet?.["!ref"];
  if (!ref) {
    return { sheetName: result.activeSheetName, grid: result.grid, merges: [], rangeOffset: { row: 0, col: 0 } };
  }

  const range = XLSX.utils.decode_range(ref);
  const merges: MergeRegion[] = (sheet["!merges"] ?? []).map((merge) => ({
    startRow: merge.s.r - range.s.r,
    startCol: merge.s.c - range.s.c,
    endRow: merge.e.r - range.s.r,
    endCol: merge.e.c - range.s.c,
  }));

  return {
    sheetName: result.activeSheetName,
    grid: result.grid,
    merges,
    rangeOffset: { row: range.s.r, col: range.s.c },
  };
}

export function getMergeAt(merges: MergeRegion[], row: number, col: number): {
  isOrigin: boolean;
  rowSpan: number;
  colSpan: number;
  region: MergeRegion | null;
} {
  for (const region of merges) {
    if (row >= region.startRow && row <= region.endRow && col >= region.startCol && col <= region.endCol) {
      return {
        isOrigin: row === region.startRow && col === region.startCol,
        rowSpan: region.endRow - region.startRow + 1,
        colSpan: region.endCol - region.startCol + 1,
        region,
      };
    }
  }
  return { isOrigin: true, rowSpan: 1, colSpan: 1, region: null };
}
