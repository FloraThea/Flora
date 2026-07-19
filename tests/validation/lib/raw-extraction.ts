import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  extractSchoolYearFromText,
  parseCalendarDateCell,
  parsePartialFrenchDate,
} from "@/lib/programming/import/spreadsheet-deterministic";

export type RawCellRecord = {
  sheet: string;
  cellRef: string;
  row: number;
  col: number;
  rawValue: string | number | boolean | null;
  displayValue: string;
  excelType: string | null;
  formula: string | null;
  convertedDate: string | null;
  mergeRange: string | null;
};

export type RawSheetExtraction = {
  sheetName: string;
  rows: number;
  cols: number;
  merges: number;
  nonEmptyCells: number;
  headerRows: number[];
  mergedRanges: string[];
  detectedDates: string[];
  detectedDays: string[];
  detectedWeeks: string[];
  detectedPeriods: string[];
  detectedSequences: string[];
  detectedSeances: string[];
  cells: RawCellRecord[];
};

export type RawWorkbookExtraction = {
  fileName: string;
  generatedAt: string;
  schoolYear: string | null;
  sheetCount: number;
  sheets: RawSheetExtraction[];
};

function encodeCol(col: number): string {
  let n = col + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function detectSheetSignals(cells: RawCellRecord[]) {
  const dates = new Set<string>();
  const days = new Set<string>();
  const weeks = new Set<string>();
  const periods = new Set<string>();
  const sequences = new Set<string>();
  const seances = new Set<string>();

  for (const cell of cells) {
    const value = cell.displayValue.trim();
    if (!value) continue;
    if (cell.convertedDate) dates.add(cell.convertedDate);
    if (/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i.test(value)) {
      days.add(value.split(/\s+/)[0] ?? value);
    }
    if (/^s\d+$/i.test(value)) weeks.add(value.toUpperCase());
    if (/^p[ée]riode\s*\d+/i.test(value)) periods.add(value.replace(/\s+/g, " "));
    if (/s[ée]quence/i.test(value)) sequences.add(value.slice(0, 80));
    if (/^s[ée]ance/i.test(value) || /^\d+\.\s/.test(value)) seances.add(value.slice(0, 80));
  }

  return {
    detectedDates: [...dates].sort(),
    detectedDays: [...days],
    detectedWeeks: [...weeks],
    detectedPeriods: [...periods],
    detectedSequences: [...sequences].slice(0, 30),
    detectedSeances: [...seances].slice(0, 40),
  };
}

export function buildRawExtraction(buffer: Buffer, fileName: string): RawWorkbookExtraction {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const schoolYear =
    extractSchoolYearFromText(workbook.SheetNames.map((name) => name).join(" ")) ?? null;

  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const ref = sheet?.["!ref"];
    if (!ref) {
      return {
        sheetName,
        rows: 0,
        cols: 0,
        merges: 0,
        nonEmptyCells: 0,
        headerRows: [],
        mergedRanges: [],
        detectedDates: [],
        detectedDays: [],
        detectedWeeks: [],
        detectedPeriods: [],
        detectedSequences: [],
        detectedSeances: [],
        cells: [] as RawCellRecord[],
      };
    }

    const range = XLSX.utils.decode_range(ref);
    const mergeMap = new Map<string, string>();
    const mergedRanges: string[] = [];
    for (const merge of sheet["!merges"] ?? []) {
      const topLeft = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const mergeRange = `${topLeft}:${XLSX.utils.encode_cell({ r: merge.e.r, c: merge.e.c })}`;
      mergedRanges.push(mergeRange);
      for (let r = merge.s.r; r <= merge.e.r; r += 1) {
        for (let c = merge.s.c; c <= merge.e.c; c += 1) {
          mergeMap.set(`${r}:${c}`, mergeRange);
        }
      }
    }

    const cells: RawCellRecord[] = [];
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        const displayValue =
          cell?.w ??
          (cell?.v instanceof Date ? cell.v.toISOString().slice(0, 10) : String(cell?.v ?? "")).trim();
        if (!displayValue) continue;

        let convertedDate: string | null = null;
        if (cell?.t === "d" && cell.v instanceof Date) {
          convertedDate = cell.v.toISOString().slice(0, 10);
        } else {
          convertedDate =
            parseCalendarDateCell(displayValue, typeof cell?.v === "number" ? cell.v : undefined, schoolYear) ??
            parsePartialFrenchDate(displayValue, schoolYear);
        }

        cells.push({
          sheet: sheetName,
          cellRef: addr,
          row: r + 1,
          col: c + 1,
          rawValue: cell?.v ?? null,
          displayValue,
          excelType: cell?.t ?? null,
          formula: typeof cell?.f === "string" ? cell.f : null,
          convertedDate,
          mergeRange: mergeMap.get(`${r}:${c}`) ?? null,
        });
      }
    }

    const signals = detectSheetSignals(cells);
    return {
      sheetName,
      rows: range.e.r - range.s.r + 1,
      cols: range.e.c - range.s.c + 1,
      merges: (sheet["!merges"] ?? []).length,
      nonEmptyCells: cells.length,
      headerRows: cells
        .filter((cell) => /semaine|date|oeuvre|œuvre|domaine|séance|seance/i.test(cell.displayValue))
        .map((cell) => cell.row),
      mergedRanges,
      ...signals,
      cells,
    };
  });

  return {
    fileName,
    generatedAt: new Date().toISOString(),
    schoolYear,
    sheetCount: sheets.length,
    sheets,
  };
}

export function writeRawExtraction(outPath: string, extraction: RawWorkbookExtraction) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(extraction, null, 2)}\n`);
}

export function cellRef(rowIndex: number, colIndex: number): string {
  return `${encodeCol(colIndex)}${rowIndex + 1}`;
}
