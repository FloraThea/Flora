import * as XLSX from "xlsx";

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
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Le fichier ne contient aucune feuille.");
  }

  const sheet = workbook.Sheets[sheetName];
  const ref = sheet["!ref"];
  if (!ref) {
    return { sheetName, grid: [], merges: [], rangeOffset: { row: 0, col: 0 } };
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ""),
  );

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      const value = cell?.w ?? cell?.v;
      grid[r - range.s.r][c - range.s.c] =
        value === undefined || value === null ? "" : String(value).trim();
    }
  }

  const merges: MergeRegion[] = (sheet["!merges"] ?? []).map((merge) => ({
    startRow: merge.s.r - range.s.r,
    startCol: merge.s.c - range.s.c,
    endRow: merge.e.r - range.s.r,
    endCol: merge.e.c - range.s.c,
  }));

  for (const merge of merges) {
    const topLeft = sheet[XLSX.utils.encode_cell({ r: merge.startRow + range.s.r, c: merge.startCol + range.s.c })];
    const value = topLeft?.w ?? topLeft?.v ?? "";
    const text = value === undefined || value === null ? "" : String(value).trim();

    for (let r = merge.startRow; r <= merge.endRow; r++) {
      for (let c = merge.startCol; c <= merge.endCol; c++) {
        if (r >= 0 && r < rowCount && c >= 0 && c < colCount) {
          grid[r][c] = text;
        }
      }
    }
  }

  return {
    sheetName,
    grid: trimEmptyMargins(grid),
    merges,
    rangeOffset: { row: range.s.r, col: range.s.c },
  };
}

function trimEmptyMargins(grid: string[][]): string[][] {
  if (grid.length === 0) return grid;

  let firstRow = 0;
  let lastRow = grid.length - 1;
  let firstCol = 0;
  let lastCol = (grid[0]?.length ?? 1) - 1;

  while (firstRow < grid.length && isEmptyRow(grid[firstRow])) firstRow++;
  while (lastRow > firstRow && isEmptyRow(grid[lastRow])) lastRow--;
  while (firstCol <= lastCol && isEmptyColumn(grid, firstCol)) firstCol++;
  while (lastCol >= firstCol && isEmptyColumn(grid, lastCol)) lastCol--;

  if (firstRow > lastRow) return grid;

  return grid.slice(firstRow, lastRow + 1).map((row) => row.slice(firstCol, lastCol + 1));
}

function isEmptyRow(row: string[] | undefined): boolean {
  return !row?.some((cell) => String(cell ?? "").trim());
}

function isEmptyColumn(grid: string[][], col: number): boolean {
  return !grid.some((row) => String(row[col] ?? "").trim());
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
