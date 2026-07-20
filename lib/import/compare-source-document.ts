import type { SourceDocument } from "./source-document";

export type SourceDocumentComparisonIssue = {
  code: string;
  message: string;
};

export type SourceDocumentComparisonResult = {
  ok: boolean;
  issues: SourceDocumentComparisonIssue[];
};

export function compareSourceDocuments(
  expected: SourceDocument,
  actual: SourceDocument | null | undefined,
): SourceDocumentComparisonResult {
  const issues: SourceDocumentComparisonIssue[] = [];

  if (!actual) {
    return {
      ok: false,
      issues: [{ code: "missing", message: "Document source absent." }],
    };
  }

  if (expected.sheets.length !== actual.sheets.length) {
    issues.push({
      code: "sheet_count",
      message: `Nombre de feuilles : attendu ${expected.sheets.length}, obtenu ${actual.sheets.length}.`,
    });
  }

  const sheetCount = Math.min(expected.sheets.length, actual.sheets.length);
  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const expectedSheet = expected.sheets[sheetIndex];
    const actualSheet = actual.sheets[sheetIndex];

    if (expectedSheet.name !== actualSheet.name) {
      issues.push({
        code: "sheet_name",
        message: `Feuille ${sheetIndex + 1} : « ${expectedSheet.name} » ≠ « ${actualSheet.name} ».`,
      });
    }

    if (expectedSheet.rowCount !== actualSheet.rowCount) {
      issues.push({
        code: "row_count",
        message: `Feuille « ${expectedSheet.name} » : ${expectedSheet.rowCount} lignes attendues, ${actualSheet.rowCount} obtenues.`,
      });
    }

    if (expectedSheet.colCount !== actualSheet.colCount) {
      issues.push({
        code: "col_count",
        message: `Feuille « ${expectedSheet.name} » : ${expectedSheet.colCount} colonnes attendues, ${actualSheet.colCount} obtenues.`,
      });
    }

    const rowCount = Math.min(expectedSheet.rows.length, actualSheet.rows.length);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const expectedRow = expectedSheet.rows[rowIndex] ?? [];
      const actualRow = actualSheet.rows[rowIndex] ?? [];
      const colCount = Math.min(expectedRow.length, actualRow.length);

      for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
        const expectedValue = expectedRow[colIndex]?.displayValue ?? "";
        const actualValue = actualRow[colIndex]?.displayValue ?? "";
        if (expectedValue !== actualValue) {
          issues.push({
            code: "cell_value",
            message: `Cellule [${expectedSheet.name} R${rowIndex + 1} C${colIndex + 1}] : « ${expectedValue.slice(0, 40)} » ≠ « ${actualValue.slice(0, 40)} ».`,
          });
        }
      }
    }

    if (expectedSheet.mergedRanges.length !== actualSheet.mergedRanges.length) {
      issues.push({
        code: "merge_count",
        message: `Feuille « ${expectedSheet.name} » : ${expectedSheet.mergedRanges.length} fusions attendues, ${actualSheet.mergedRanges.length} obtenues.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
