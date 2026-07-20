import "server-only";

import * as XLSX from "xlsx";
import { parseCalendarDateCell } from "@/lib/programming/import/spreadsheet-deterministic";
import type { SourceCell, SourceDocument, SourceMergeRange, SourceSheet } from "./source-document";

function cellDisplayValue(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";

  if (cell.t === "d" && cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }

  if (cell.t === "n" && typeof cell.v === "number") {
    const iso = parseCalendarDateCell("", cell.v);
    if (iso) return iso;
  }

  const formatted = cell.w ?? cell.v;
  if (formatted === undefined || formatted === null) return "";
  return String(formatted);
}

function cellStyle(cell: XLSX.CellObject | undefined): SourceCell["style"] | undefined {
  if (!cell?.s || typeof cell.s !== "object") return undefined;

  const style = cell.s as {
    fill?: { fgColor?: { rgb?: string } };
    font?: { bold?: boolean; italic?: boolean; color?: { rgb?: string } };
    alignment?: { horizontal?: string };
  };

  const backgroundColor = style.fill?.fgColor?.rgb
    ? `#${style.fill.fgColor.rgb.slice(-6)}`
    : undefined;
  const color = style.font?.color?.rgb ? `#${style.font.color.rgb.slice(-6)}` : undefined;
  const textAlign = style.alignment?.horizontal as SourceCell["style"] extends infer S
    ? S extends { textAlign?: infer T }
      ? T
      : never
    : never;

  if (!backgroundColor && !color && !style.font?.bold && !style.font?.italic && !textAlign) {
    return undefined;
  }

  return {
    backgroundColor,
    color,
    fontWeight: style.font?.bold ? "bold" : undefined,
    fontStyle: style.font?.italic ? "italic" : undefined,
    textAlign: textAlign === "center" || textAlign === "right" ? textAlign : "left",
  };
}

function sheetScore(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
}

function extractSheet(sheet: XLSX.WorkSheet, name: string, activeForParse: boolean): SourceSheet {
  const ref = sheet["!ref"];
  if (!ref) {
    return {
      name,
      activeForParse,
      rowCount: 0,
      colCount: 0,
      rangeStartRow: 0,
      rangeStartCol: 0,
      mergedRanges: [],
      rows: [],
    };
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;

  const mergedRanges: SourceMergeRange[] = (sheet["!merges"] ?? []).map((merge) => ({
    startRow: merge.s.r - range.s.r,
    startCol: merge.s.c - range.s.c,
    endRow: merge.e.r - range.s.r,
    endCol: merge.e.c - range.s.c,
  }));

  const rows: SourceCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: SourceCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      row.push({
        displayValue: cellDisplayValue(cell),
        rawValue:
          cell?.v === undefined || cell?.v === null
            ? null
            : cell.v instanceof Date
              ? cell.v.toISOString()
              : (cell.v as string | number | boolean),
        style: cellStyle(cell),
      });
    }
    rows.push(row);
  }

  return {
    name,
    activeForParse,
    rowCount,
    colCount,
    rangeStartRow: range.s.r,
    rangeStartCol: range.s.c,
    mergedRanges,
    rows,
  };
}

function pickActiveSheetIndex(sheets: SourceSheet[]): number {
  let bestIndex = 0;
  let bestScore = 0;
  sheets.forEach((sheet, index) => {
    const score = sheet.rowCount * sheet.colCount;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function extractSourceDocumentFromExcel(
  buffer: Buffer,
  fileName: string,
  parsedSheetName?: string,
): SourceDocument {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  const parsedIndex = parsedSheetName
    ? workbook.SheetNames.indexOf(parsedSheetName)
    : -1;

  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const activeForParse = parsedIndex >= 0 ? name === parsedSheetName : false;
    return extractSheet(sheet, name, activeForParse);
  });

  if (parsedIndex >= 0) {
    sheets[parsedIndex] = { ...sheets[parsedIndex], activeForParse: true };
  }

  const activeSheetIndex =
    parsedIndex >= 0 ? parsedIndex : pickActiveSheetIndex(sheets);

  if (sheets[activeSheetIndex]) {
    sheets[activeSheetIndex] = { ...sheets[activeSheetIndex], activeForParse: true };
  }

  return {
    version: 1,
    fileName,
    format: "excel",
    importedAt: new Date().toISOString(),
    activeSheetIndex,
    sheets,
  };
}

export function extractSourceDocumentFromGrid(input: {
  fileName: string;
  format: SourceDocument["format"];
  grid: string[][];
  sheetName?: string;
}): SourceDocument {
  const rows: SourceCell[][] = input.grid.map((gridRow) =>
    gridRow.map((value) => ({ displayValue: value ?? "" })),
  );

  return {
    version: 1,
    fileName: input.fileName,
    format: input.format,
    importedAt: new Date().toISOString(),
    activeSheetIndex: 0,
    sheets: [
      {
        name: input.sheetName ?? "Feuille 1",
        activeForParse: true,
        rowCount: rows.length,
        colCount: rows[0]?.length ?? 0,
        rangeStartRow: 0,
        rangeStartCol: 0,
        mergedRanges: [],
        rows,
      },
    ],
  };
}

export function extractSourceDocumentFromTextLines(input: {
  fileName: string;
  format: SourceDocument["format"];
  lines: string[];
}): SourceDocument {
  const grid = input.lines.map((line) => [line]);
  return extractSourceDocumentFromGrid({
    fileName: input.fileName,
    format: input.format,
    grid,
    sheetName: "Texte",
  });
}

function csvGridFromText(text: string, parseLine: (line: string) => string[]): string[][] {
  return text.split(/\r?\n/).map((line) => (line.length === 0 ? [""] : parseLine(line)));
}

export function buildSourceDocumentForImport(input: {
  format: SourceDocument["format"] | "word" | "unsupported";
  fileName: string;
  buffer?: Buffer;
  pastedText?: string;
  sheetName?: string;
  textLines?: string[];
  parseCsvLine?: (line: string, delimiter: string) => string[];
  detectDelimiter?: (sampleLine: string) => string;
}): SourceDocument | undefined {
  if (input.pastedText?.trim()) {
    const text = input.pastedText;
    const delimiter = input.detectDelimiter?.(text.split(/\r?\n/)[0] ?? "") ?? "\t";
    const grid = csvGridFromText(text, (line) =>
      input.parseCsvLine ? input.parseCsvLine(line, delimiter) : [line],
    );
    return extractSourceDocumentFromGrid({
      fileName: input.fileName,
      format: "text",
      grid,
    });
  }

  if (!input.buffer) {
    if (input.textLines?.length) {
      return extractSourceDocumentFromTextLines({
        fileName: input.fileName,
        format: input.format === "pdf" || input.format === "image" ? input.format : "text",
        lines: input.textLines,
      });
    }
    return undefined;
  }

  if (input.format === "excel") {
    return extractSourceDocumentFromExcel(input.buffer, input.fileName, input.sheetName);
  }

  if (input.format === "csv") {
    let text = input.buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const delimiter = input.detectDelimiter?.(text.split(/\r?\n/)[0] ?? "") ?? ";";
    const grid = csvGridFromText(text, (line) =>
      input.parseCsvLine ? input.parseCsvLine(line, delimiter) : line.split(delimiter),
    );
    return extractSourceDocumentFromGrid({
      fileName: input.fileName,
      format: "csv",
      grid,
    });
  }

  if (input.textLines?.length) {
    return extractSourceDocumentFromTextLines({
      fileName: input.fileName,
      format: input.format === "pdf" || input.format === "image" ? input.format : "text",
      lines: input.textLines,
    });
  }

  return undefined;
}
