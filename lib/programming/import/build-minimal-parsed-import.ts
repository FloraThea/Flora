import type { ParsedProgrammationImport } from "./types";

export function buildMinimalParsedFromUpload(input: {
  batchId: string;
  mergeMode?: "single_document" | "multiple_programmations";
  pages: Array<{
    fileId: string;
    filename: string;
    pageOrder: number;
    storagePath: string;
    pdfPageNumber?: number;
  }>;
  warning?: string;
}): ParsedProgrammationImport {
  const warning =
    input.warning ??
    "Les fichiers sont téléversés, mais l'analyse automatique n'a pas extrait de lignes. Réessayez l'analyse ou importez un export Excel/CSV.";

  return {
    format: "image",
    fileName: input.pages[0]?.filename ?? "import-lot",
    discipline: "",
    niveau: "",
    rows: [],
    warnings: [warning],
    columns: [],
    previewRows: [],
    rowCount: 0,
    needsColumnMapping: false,
    detectedFields: {},
    extractedTextPreview: "",
    batchMeta: {
      batchId: input.batchId,
      mergeMode: input.mergeMode ?? "single_document",
      sourceFiles: input.pages.map((page) => ({
        fileId: page.fileId,
        fileName: page.filename,
        pageOrder: page.pageOrder,
        storagePath: page.storagePath,
        pdfPageNumber: page.pdfPageNumber,
      })),
    },
  };
}

export function mergeParsedProgrammationImports(
  left: ParsedProgrammationImport,
  right: ParsedProgrammationImport,
): ParsedProgrammationImport {
  const rows = [...left.rows, ...right.rows];
  return {
    ...right,
    fileName: left.fileName || right.fileName,
    discipline: left.discipline || right.discipline,
    niveau: left.niveau || right.niveau,
    rows,
    rowCount: rows.length,
    warnings: [...new Set([...left.warnings, ...right.warnings])],
    columns: left.columns.length > 0 ? left.columns : right.columns,
    previewRows: rows.slice(0, 8).map((row) => [
      row.weekLabel,
      row.discipline,
      row.seance,
      row.objectif,
      row.competences.join("; "),
    ]),
    needsColumnMapping: left.needsColumnMapping || right.needsColumnMapping,
    detectedFields: { ...left.detectedFields, ...right.detectedFields },
    extractedTextPreview: [left.extractedTextPreview, right.extractedTextPreview]
      .filter(Boolean)
      .join("\n---\n")
      .slice(0, 2400),
    batchMeta: left.batchMeta ?? right.batchMeta,
  };
}
