import * as XLSX from "xlsx";
import { parseCalendarDateCell } from "@/lib/programming/import/spreadsheet-deterministic";

export type ExcelGridSnapshot = {
  sheetNames: string[];
  sheetName: string;
  grid: string[][];
  sourceCells: Array<{ row: number; col: number; value: string }>;
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

function cellToText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.t === "d" && cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }
  if (cell.t === "n" && typeof cell.v === "number") {
    return parseCalendarDateCell("", cell.v) ?? String(cell.w ?? cell.v).trim();
  }
  const value = cell.w ?? cell.v;
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (!text && typeof cell.v === "number") {
    return parseCalendarDateCell("", cell.v) ?? "";
  }
  return text;
}

function pickBestSheet(workbook: XLSX.WorkBook, preferred?: string): string {
  if (preferred && workbook.SheetNames.includes(preferred)) return preferred;
  let best = workbook.SheetNames[0];
  let bestScore = 0;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const ref = sheet?.["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const score = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  if (!best) throw new Error("Classeur Excel sans feuille.");
  return best;
}

export function readExcelGrid(buffer: Buffer, fileName: string, preferredSheet?: string): ExcelGridSnapshot {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const sheetName = pickBestSheet(workbook, preferredSheet);
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet?.["!ref"];
  if (!ref) {
    return { sheetNames: workbook.SheetNames, sheetName, grid: [], sourceCells: [] };
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ""),
  );

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      grid[r - range.s.r][c - range.s.c] = cellToText(sheet[addr]);
    }
  }

  const merges = sheet["!merges"] ?? [];
  for (const merge of merges) {
    const topLeft = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
    const text = cellToText(topLeft);
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

  const trimmed = trimEmptyMargins(grid);
  const sourceCells: ExcelGridSnapshot["sourceCells"] = [];
  for (let row = 0; row < trimmed.length; row += 1) {
    for (let col = 0; col < (trimmed[row]?.length ?? 0); col += 1) {
      const value = String(trimmed[row]?.[col] ?? "").trim();
      if (value) sourceCells.push({ row, col, value });
    }
  }

  return {
    sheetNames: workbook.SheetNames,
    sheetName,
    grid: trimmed,
    sourceCells,
  };
}
