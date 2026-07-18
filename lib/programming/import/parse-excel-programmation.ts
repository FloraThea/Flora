import "server-only";

import * as XLSX from "xlsx";
import { parseCalendarDateCell } from "./spreadsheet-deterministic";

export type ProgrammationWorkbookData = {
  sheetNames: string[];
  sheetName: string;
  grid: string[][];
};

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

function sheetScore(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
}

function readSheetGrid(sheet: XLSX.WorkSheet): string[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ""),
  );

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      let text = "";
      if (cell) {
        if (cell.t === "d" && cell.v instanceof Date) {
          text = cell.v.toISOString().slice(0, 10);
        } else if (cell.t === "n" && typeof cell.v === "number") {
          const iso = parseCalendarDateCell("", cell.v);
          text = iso ?? (cell.w ?? String(cell.v)).trim();
        } else {
          const value = cell.w ?? cell.v;
          text = value === undefined || value === null ? "" : String(value).trim();
          if (!text && typeof cell.v === "number") {
            const iso = parseCalendarDateCell("", cell.v);
            if (iso) text = iso;
          }
        }
      }
      grid[r - range.s.r][c - range.s.c] = text;
    }
  }

  const merges = sheet["!merges"] ?? [];
  for (const merge of merges) {
    const topLeft = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
    let text = "";
    if (topLeft) {
      if (topLeft.t === "d" && topLeft.v instanceof Date) {
        text = topLeft.v.toISOString().slice(0, 10);
      } else if (topLeft.t === "n" && typeof topLeft.v === "number") {
        text = parseCalendarDateCell("", topLeft.v) ?? String(topLeft.w ?? topLeft.v).trim();
      } else {
        const value = topLeft.w ?? topLeft.v ?? "";
        text = value === undefined || value === null ? "" : String(value).trim();
      }
    }

    for (let r = merge.s.r; r <= merge.e.r; r += 1) {
      for (let c = merge.s.c; c <= merge.e.c; c += 1) {
        const row = r - range.s.r;
        const col = c - range.s.c;
        if (row >= 0 && row < rowCount && col >= 0 && col < colCount) {
          grid[row][col] = text;
        }
      }
    }
  }

  return trimEmptyMargins(grid);
}

function pickBestSheetName(workbook: XLSX.WorkBook, preferred?: string): string {
  if (preferred && workbook.SheetNames.includes(preferred)) return preferred;

  let best = workbook.SheetNames[0];
  let bestScore = 0;

  for (const name of workbook.SheetNames) {
    const score = sheetScore(workbook.Sheets[name]);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  if (!best) throw new Error("Le classeur Excel ne contient aucune feuille.");
  return best;
}

export function readProgrammationWorkbook(
  buffer: Buffer,
  fileName: string,
  preferredSheetName?: string,
): ProgrammationWorkbookData {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new Error("Format Excel attendu (.xlsx ou .xls).");
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("Le fichier Excel ne contient aucune feuille.");
  }

  const sheetName = pickBestSheetName(workbook, preferredSheetName);
  const grid = readSheetGrid(workbook.Sheets[sheetName]);

  return {
    sheetNames: workbook.SheetNames,
    sheetName,
    grid,
  };
}
