import * as XLSX from "xlsx";
import { parseCalendarDateCell } from "@/lib/programming/import/spreadsheet-deterministic";

export type ExcelSheetStats = {
  sheetName: string;
  ref: string | null;
  rowCount: number;
  colCount: number;
  nonEmptyCells: number;
  mergeCount: number;
};

export type ExcelWorkbookReadResult = {
  sheetNames: string[];
  activeSheetName: string;
  grid: string[][];
  stats: ExcelSheetStats;
  allSheetStats: ExcelSheetStats[];
};

export type ExcelReadDiagnostics = {
  sheetCount: number;
  activeSheet: string;
  rowCount: number;
  colCount: number;
  nonEmptyCells: number;
  mergeCount: number;
  rejectReason?: string;
};

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.t === "d" && cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }
  if (cell.t === "n" && typeof cell.v === "number") {
    const iso = parseCalendarDateCell("", cell.v);
    return iso ?? String(cell.w ?? cell.v).trim();
  }
  const value = cell.w ?? cell.v;
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (!text && typeof cell.v === "number") {
    const iso = parseCalendarDateCell("", cell.v);
    if (iso) return iso;
  }
  return text;
}

function resolveSheetBounds(sheet: XLSX.WorkSheet): XLSX.Range | null {
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = -1;
  let maxCol = -1;

  const include = (row: number, col: number) => {
    minRow = Math.min(minRow, row);
    minCol = Math.min(minCol, col);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  };

  const ref = sheet["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    include(range.s.r, range.s.c);
    include(range.e.r, range.e.c);
  }

  for (const key of Object.keys(sheet)) {
    if (key.startsWith("!")) continue;
    try {
      const addr = XLSX.utils.decode_cell(key);
      const text = cellText(sheet[key]);
      if (text) include(addr.r, addr.c);
    } catch {
      // Ignore malformed addresses.
    }
  }

  if (maxRow < 0 || maxCol < 0) return null;

  return {
    s: { r: minRow, c: minCol },
    e: { r: maxRow, c: maxCol },
  };
}

function trimEmptyMargins(grid: string[][]): string[][] {
  if (grid.length === 0) return grid;

  let firstRow = 0;
  let lastRow = grid.length - 1;
  let firstCol = 0;
  let lastCol = (grid[0]?.length ?? 1) - 1;

  const isEmptyRow = (row: string[] | undefined) => !row?.some((cell) => String(cell ?? "").trim());
  const isEmptyColumn = (col: number) => !grid.some((row) => String(row[col] ?? "").trim());

  while (firstRow < grid.length && isEmptyRow(grid[firstRow])) firstRow += 1;
  while (lastRow > firstRow && isEmptyRow(grid[lastRow])) lastRow -= 1;
  while (firstCol <= lastCol && isEmptyColumn(firstCol)) firstCol += 1;
  while (lastCol >= firstCol && isEmptyColumn(lastCol)) lastCol -= 1;

  if (firstRow > lastRow) return [];

  return grid.slice(firstRow, lastRow + 1).map((row) => row.slice(firstCol, lastCol + 1));
}

function countNonEmptyCells(grid: string[][]): number {
  return grid.reduce(
    (total, row) => total + row.filter((cell) => String(cell ?? "").trim()).length,
    0,
  );
}

function readSheetGrid(sheet: XLSX.WorkSheet): { grid: string[][]; stats: ExcelSheetStats } {
  const bounds = resolveSheetBounds(sheet);
  const mergeCount = sheet["!merges"]?.length ?? 0;

  if (!bounds) {
    return {
      grid: [],
      stats: {
        sheetName: "",
        ref: null,
        rowCount: 0,
        colCount: 0,
        nonEmptyCells: 0,
        mergeCount,
      },
    };
  }

  const rowCount = bounds.e.r - bounds.s.r + 1;
  const colCount = bounds.e.c - bounds.s.c + 1;
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ""),
  );

  for (let r = bounds.s.r; r <= bounds.e.r; r += 1) {
    for (let c = bounds.s.c; c <= bounds.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      grid[r - bounds.s.r][c - bounds.s.c] = cellText(sheet[addr]);
    }
  }

  for (const merge of sheet["!merges"] ?? []) {
    const topLeft = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
    const text = cellText(topLeft);
    if (!text) continue;

    for (let r = merge.s.r; r <= merge.e.r; r += 1) {
      for (let c = merge.s.c; c <= merge.e.c; c += 1) {
        const row = r - bounds.s.r;
        const col = c - bounds.s.c;
        if (row >= 0 && row < rowCount && col >= 0 && col < colCount) {
          grid[row][col] = text;
        }
      }
    }
  }

  const trimmed = trimEmptyMargins(grid);
  const ref = XLSX.utils.encode_range(bounds);

  return {
    grid: trimmed,
    stats: {
      sheetName: "",
      ref,
      rowCount: trimmed.length,
      colCount: trimmed[0]?.length ?? 0,
      nonEmptyCells: countNonEmptyCells(trimmed),
      mergeCount,
    },
  };
}

function pickBestSheet(
  workbook: XLSX.WorkBook,
  preferredSheetName?: string,
): { sheetName: string; grid: string[][]; stats: ExcelSheetStats } {
  if (preferredSheetName && workbook.SheetNames.includes(preferredSheetName)) {
    const sheet = workbook.Sheets[preferredSheetName];
    const result = readSheetGrid(sheet);
    return { sheetName: preferredSheetName, grid: result.grid, stats: { ...result.stats, sheetName: preferredSheetName } };
  }

  let bestName = workbook.SheetNames[0] ?? "";
  let bestGrid: string[][] = [];
  let bestStats: ExcelSheetStats = {
    sheetName: bestName,
    ref: null,
    rowCount: 0,
    colCount: 0,
    nonEmptyCells: 0,
    mergeCount: 0,
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const result = readSheetGrid(sheet);
    const stats = { ...result.stats, sheetName };
    if (stats.nonEmptyCells > bestStats.nonEmptyCells) {
      bestName = sheetName;
      bestGrid = result.grid;
      bestStats = stats;
    }
  }

  if (!bestName) {
    throw new Error("Le classeur Excel ne contient aucune feuille.");
  }

  return { sheetName: bestName, grid: bestGrid, stats: bestStats };
}

export function readSheetGridFromWorksheet(sheet: XLSX.WorkSheet, sheetName = ""): {
  grid: string[][];
  stats: ExcelSheetStats;
} {
  const result = readSheetGrid(sheet);
  return {
    grid: result.grid,
    stats: { ...result.stats, sheetName },
  };
}

export function readAllWorkbookSheets(
  buffer: Buffer,
  fileName: string,
): {
  sheetNames: string[];
  sheets: Array<{ sheetName: string; grid: string[][]; stats: ExcelSheetStats }>;
} {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new Error("Format Excel attendu (.xlsx ou .xls).");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: false,
      cellText: true,
    });
  } catch (firstError) {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      raw: true,
    });
    if (!workbook.SheetNames.length) {
      throw firstError instanceof Error ? firstError : new Error("Lecture Excel impossible.");
    }
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error("Le fichier Excel ne contient aucune feuille.");
  }

  const sheets = workbook.SheetNames.map((sheetName) => {
    const result = readSheetGridFromWorksheet(workbook.Sheets[sheetName]!, sheetName);
    return { sheetName, grid: result.grid, stats: result.stats };
  });

  return { sheetNames: workbook.SheetNames, sheets };
}

export function readExcelWorkbook(
  buffer: Buffer,
  fileName: string,
  preferredSheetName?: string,
): ExcelWorkbookReadResult {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new Error("Format Excel attendu (.xlsx ou .xls).");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: false,
      cellText: true,
    });
  } catch (firstError) {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      raw: true,
    });
    if (!workbook.SheetNames.length) {
      throw firstError instanceof Error ? firstError : new Error("Lecture Excel impossible.");
    }
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error("Le fichier Excel ne contient aucune feuille.");
  }

  const allSheetStats = workbook.SheetNames.map((sheetName) => {
    const result = readSheetGrid(workbook.Sheets[sheetName]);
    return { ...result.stats, sheetName };
  });

  const picked = pickBestSheet(workbook, preferredSheetName);

  return {
    sheetNames: workbook.SheetNames,
    activeSheetName: picked.sheetName,
    grid: picked.grid,
    stats: picked.stats,
    allSheetStats,
  };
}

export function buildExcelReadDiagnostics(result: ExcelWorkbookReadResult): ExcelReadDiagnostics {
  return {
    sheetCount: result.sheetNames.length,
    activeSheet: result.activeSheetName,
    rowCount: result.stats.rowCount,
    colCount: result.stats.colCount,
    nonEmptyCells: result.stats.nonEmptyCells,
    mergeCount: result.stats.mergeCount,
  };
}

export function logExcelReadDiagnostics(fileName: string, diagnostics: ExcelReadDiagnostics): void {
  console.info("[excel-import]", {
    fileName,
    sheetCount: diagnostics.sheetCount,
    activeSheet: diagnostics.activeSheet,
    rows: diagnostics.rowCount,
    cols: diagnostics.colCount,
    nonEmptyCells: diagnostics.nonEmptyCells,
    merges: diagnostics.mergeCount,
    rejectReason: diagnostics.rejectReason ?? null,
  });
}
