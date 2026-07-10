import "server-only";

import { extractTextFromBuffer } from "@/lib/documents/extract-text";
import {
  buildDetectedFields,
  buildPreviewText,
  detectDelimiter,
  inferDiscipline,
  inferNiveau,
  parseCsvLine,
  parseStructuredText,
  rowsFromGrid,
} from "./grid-parser";
import { readProgrammationWorkbook } from "./parse-excel-programmation";
import type {
  ParsedProgrammationImport,
  ProgrammationColumnField,
  ProgrammationImportFormat,
} from "./types";

function detectFormat(fileName: string, mimeType?: string): ProgrammationImportFormat | "unsupported" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (lower.endsWith(".csv") || mimeType === "text/csv") return "csv";
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "excel";
  }
  if (
    lower.endsWith(".docx") ||
    lower.endsWith(".doc") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }
  if (lower.endsWith(".txt")) return "text";
  return "unsupported";
}

function readCsvText(buffer: Buffer): string {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

export async function parseProgrammationFile(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
  columnMapping?: Partial<Record<ProgrammationColumnField, number>>;
  sheetName?: string;
}): Promise<ParsedProgrammationImport> {
  const format = input.pastedText ? "text" : detectFormat(input.fileName, input.mimeType);
  const warnings: string[] = [];

  if (format === "unsupported") {
    return {
      format: "text",
      fileName: input.fileName,
      discipline: "",
      niveau: "",
      rows: [],
      warnings: [
        `Format non supporté (${input.fileName}). Formats acceptés : Excel (.xlsx, .xls), CSV, PDF, Word (.docx), texte.`,
      ],
      columns: [],
      previewRows: [],
      rowCount: 0,
      needsColumnMapping: false,
      detectedFields: {},
      extractedTextPreview:
        "Ce format n'est pas encore pris en charge. Exportez votre programmation en Excel ou CSV.",
    };
  }

  let rows: ParsedProgrammationImport["rows"] = [];
  let columns: string[] = [];
  let previewRows: string[][] = [];
  let sourceGrid: string[][] = [];
  let headerRowIndex = 0;
  let headerIndex: Partial<Record<ProgrammationColumnField, number>> = {};
  let sheetNames: string[] | undefined;
  let activeSheetName: string | undefined;
  let extractedTextPreview = "";

  if (input.pastedText?.trim()) {
    const text = input.pastedText.trim();
    const delimiter = detectDelimiter(text.split(/\r?\n/).find(Boolean) ?? "");
    sourceGrid = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => parseCsvLine(line, delimiter));

    const parsedGrid = rowsFromGrid(sourceGrid, input.columnMapping);
    rows = parsedGrid.rows;
    columns = parsedGrid.headers;
    previewRows = parsedGrid.dataRows.slice(0, 8);
    headerRowIndex = parsedGrid.headerRowIndex;
    headerIndex = parsedGrid.headerIndex;
    sourceGrid =
      parsedGrid.headers.length > 0
        ? [parsedGrid.headers, ...parsedGrid.dataRows]
        : sourceGrid;
    extractedTextPreview = buildPreviewText(columns, parsedGrid.dataRows);
  } else if (format === "excel") {
    const workbook = readProgrammationWorkbook(input.buffer, input.fileName, input.sheetName);
    sheetNames = workbook.sheetNames;
    activeSheetName = workbook.sheetName;
    sourceGrid = workbook.grid;

    const parsedGrid = rowsFromGrid(workbook.grid, input.columnMapping);
    rows = parsedGrid.rows;
    columns = parsedGrid.headers;
    previewRows = parsedGrid.dataRows.slice(0, 8);
    headerRowIndex = parsedGrid.headerRowIndex;
    headerIndex = parsedGrid.headerIndex;
    extractedTextPreview = buildPreviewText(columns, parsedGrid.dataRows);

    if (workbook.grid.length === 0) {
      warnings.push("La feuille Excel sélectionnée est vide.");
    }
  } else if (format === "csv") {
    const text = readCsvText(input.buffer);
    const delimiter = detectDelimiter(text.split(/\r?\n/).find(Boolean) ?? "");
    sourceGrid = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => parseCsvLine(line, delimiter));

    const parsedGrid = rowsFromGrid(sourceGrid, input.columnMapping);
    rows = parsedGrid.rows;
    columns = parsedGrid.headers;
    previewRows = parsedGrid.dataRows.slice(0, 8);
    headerRowIndex = parsedGrid.headerRowIndex;
    headerIndex = parsedGrid.headerIndex;
    sourceGrid =
      parsedGrid.headers.length > 0
        ? [parsedGrid.headers, ...parsedGrid.dataRows]
        : sourceGrid;
    extractedTextPreview = buildPreviewText(columns, parsedGrid.dataRows);
  } else if (format === "pdf") {
    try {
      const extracted = await extractTextFromBuffer(input.buffer, input.fileName);
      const text = extracted.text.trim();
      if (!text) {
        warnings.push(
          "Extraction PDF limitée : peu de texte récupéré. Exportez en Excel ou CSV pour une analyse fiable.",
        );
        extractedTextPreview =
          "Extraction PDF limitée. Le document semble principalement graphique ou scanné.";
      } else {
        rows = parseStructuredText(text);
        extractedTextPreview = text.slice(0, 1200);
        if (rows.length === 0) {
          warnings.push(
            "Texte PDF extrait, mais aucun tableau structuré détecté. Collez un export CSV ou utilisez Excel.",
          );
        }
      }
    } catch {
      warnings.push(
        "Extraction PDF impossible. Exportez votre programmation en Excel (.xlsx) ou CSV.",
      );
      extractedTextPreview = "Extraction PDF limitée — format non structuré détecté.";
    }
  } else if (format === "word") {
    warnings.push(
      "Extraction automatique limitée pour Word (.docx). Exportez le tableau en Excel (.xlsx) ou CSV pour une analyse optimale.",
    );
    extractedTextPreview =
      "Extraction Word limitée. Flora ne lit pas encore les tableaux Word directement — utilisez Excel ou CSV.";
  } else {
    const text = input.buffer.toString("utf8");
    rows = parseStructuredText(text);
    extractedTextPreview = text.slice(0, 1200);
  }

  const needsColumnMapping =
    Object.keys(headerIndex).length < 2 &&
    (format === "excel" || format === "csv" || format === "text");

  if (rows.length === 0 && format !== "word") {
    warnings.push("Aucune ligne structurée détectée. Vérifiez le format (colonnes période, semaine, séance…).");
  }

  if (needsColumnMapping) {
    warnings.push("Structure peu claire : associez manuellement les colonnes pour continuer.");
  }

  return {
    format,
    fileName: input.fileName,
    discipline: inferDiscipline(rows),
    niveau: inferNiveau(rows),
    rows,
    warnings,
    sheetNames,
    sheetName: activeSheetName,
    columns,
    previewRows,
    rowCount: rows.length,
    needsColumnMapping,
    detectedFields: buildDetectedFields(rows, headerIndex, columns),
    columnMapping: input.columnMapping,
    headerRowIndex,
    sourceGrid,
    extractedTextPreview,
  };
}
