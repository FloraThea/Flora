import type { ImportedProgrammationRow, ParsedProgrammationImport } from "./types";
import { inferDiscipline, inferNiveau } from "./grid-parser";
import type { ProgrammationImportBatchMeta } from "./batch-types";

export type PageParseResult = {
  pageOrder: number;
  fileId: string;
  fileName: string;
  storagePath?: string;
  pdfPageNumber?: number;
  parsed: ParsedProgrammationImport;
};

function normalizeHeaderToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeHeaderRow(row: ImportedProgrammationRow, columns: string[]): boolean {
  if (columns.length === 0) return false;
  const haystack = normalizeHeaderToken(
    [row.seance, row.objectif, row.discipline, row.weekLabel, row.rawLine].join(" "),
  );
  const headerHits = columns.filter((column) => {
    const token = normalizeHeaderToken(column);
    return token.length > 2 && haystack.includes(token);
  });
  return headerHits.length >= Math.min(3, columns.length);
}

function carryForwardRowContext(
  row: ImportedProgrammationRow,
  previous: ImportedProgrammationRow | null,
): ImportedProgrammationRow {
  if (!previous) return row;
  return {
    ...row,
    periodNumber: row.periodNumber ?? previous.periodNumber,
    weekNumber: row.weekNumber ?? previous.weekNumber,
    weekLabel: row.weekLabel || previous.weekLabel,
    discipline: row.discipline || previous.discipline,
    niveau: row.niveau || previous.niveau,
    sequence: row.sequence || previous.sequence,
  };
}

function mergeRowLists(
  pages: PageParseResult[],
  primaryColumns: string[],
): ImportedProgrammationRow[] {
  const merged: ImportedProgrammationRow[] = [];
  let previous: ImportedProgrammationRow | null = null;
  let headerSeen = false;

  for (const page of pages) {
    for (const row of page.parsed.rows) {
      if (!headerSeen && looksLikeHeaderRow(row, primaryColumns)) {
        headerSeen = true;
        continue;
      }
      if (headerSeen && looksLikeHeaderRow(row, primaryColumns)) {
        continue;
      }

      const contextual = carryForwardRowContext(
        {
          ...row,
          id: `merged-${page.pageOrder}-${merged.length + 1}`,
          rawLine: `[p${page.pageOrder}] ${row.rawLine}`,
        },
        previous,
      );
      merged.push(contextual);
      previous = contextual;
    }
  }

  return merged;
}

export function mergeProgrammationPages(
  batchId: string,
  pages: PageParseResult[],
): ParsedProgrammationImport {
  const sorted = [...pages].sort((a, b) => a.pageOrder - b.pageOrder);
  const primary = sorted.find((page) => page.parsed.columns.length > 0)?.parsed ?? sorted[0]?.parsed;

  if (!primary) {
    return {
      format: "text",
      fileName: "import-lot",
      discipline: "",
      niveau: "",
      rows: [],
      warnings: ["Aucune page analysée."],
      columns: [],
      previewRows: [],
      rowCount: 0,
      needsColumnMapping: false,
      detectedFields: {},
      extractedTextPreview: "",
      batchMeta: {
        batchId,
        mergeMode: "single_document",
        sourceFiles: [],
      },
    };
  }

  const rows = mergeRowLists(sorted, primary.columns);
  const warnings = sorted.flatMap((page) =>
    page.parsed.warnings.map((warning) => `[${page.fileName}] ${warning}`),
  );

  const batchMeta: ProgrammationImportBatchMeta = {
    batchId,
    mergeMode: "single_document",
    sourceFiles: sorted.map((page) => ({
      fileId: page.fileId,
      fileName: page.fileName,
      pageOrder: page.pageOrder,
      storagePath: page.storagePath,
      pdfPageNumber: page.pdfPageNumber,
    })),
  };

  const previewRows = rows.slice(0, 8).map((row) => [
    row.weekLabel,
    row.discipline,
    row.seance,
    row.objectif,
    row.competences.join("; "),
  ]);

  return {
    ...primary,
    fileName: `import-${batchId.slice(0, 8)}`,
    discipline: inferDiscipline(rows) || primary.discipline,
    niveau: inferNiveau(rows) || primary.niveau,
    rows,
    warnings,
    previewRows,
    rowCount: rows.length,
    needsColumnMapping:
      primary.needsColumnMapping ||
      (primary.columns.length > 0 && Object.keys(primary.detectedFields).length < 2),
    extractedTextPreview: sorted
      .map((page) => page.parsed.extractedTextPreview)
      .filter(Boolean)
      .join("\n---\n")
      .slice(0, 2400),
    batchMeta,
  };
}
