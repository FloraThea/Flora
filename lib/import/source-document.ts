/** Copie fidèle du document importé — source de vérité pour l'affichage. */

export type SourceCellStyle = {
  backgroundColor?: string;
  color?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
};

export type SourceCell = {
  /** Texte affiché tel qu'importé (retours à la ligne conservés). */
  displayValue: string;
  rawValue?: string | number | boolean | null;
  style?: SourceCellStyle;
};

export type SourceMergeRange = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

export type SourceSheet = {
  name: string;
  /** Index de la feuille utilisée pour l'interprétation pédagogique. */
  activeForParse: boolean;
  rowCount: number;
  colCount: number;
  rangeStartRow: number;
  rangeStartCol: number;
  mergedRanges: SourceMergeRange[];
  /** Grille complète incluant cellules vides — ordre exact du fichier. */
  rows: SourceCell[][];
};

export type SourceDocument = {
  version: 1;
  fileName: string;
  format: "excel" | "csv" | "text" | "pdf" | "image";
  importedAt: string;
  activeSheetIndex: number;
  sheets: SourceSheet[];
};

export type FaithfulTableCell = {
  row: number;
  col: number;
  displayValue: string;
  rowSpan: number;
  colSpan: number;
  hidden: boolean;
  style?: SourceCellStyle;
};

export function isSourceDocumentEmpty(doc: SourceDocument | null | undefined): boolean {
  if (!doc || doc.sheets.length === 0) return true;
  return doc.sheets.every((sheet) => sheet.rowCount === 0 || sheet.colCount === 0);
}

export function buildFaithfulTableModel(sheet: SourceSheet): FaithfulTableCell[][] {
  const mergeTopLeft = new Map<string, SourceMergeRange>();
  const mergeCovered = new Set<string>();

  for (const merge of sheet.mergedRanges) {
    const key = `${merge.startRow}:${merge.startCol}`;
    mergeTopLeft.set(key, merge);
    for (let r = merge.startRow; r <= merge.endRow; r += 1) {
      for (let c = merge.startCol; c <= merge.endCol; c += 1) {
        if (r !== merge.startRow || c !== merge.startCol) {
          mergeCovered.add(`${r}:${c}`);
        }
      }
    }
  }

  return sheet.rows.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      const key = `${rowIndex}:${colIndex}`;
      if (mergeCovered.has(key)) {
        return {
          row: rowIndex,
          col: colIndex,
          displayValue: "",
          rowSpan: 1,
          colSpan: 1,
          hidden: true,
        };
      }

      const merge = mergeTopLeft.get(key);
      return {
        row: rowIndex,
        col: colIndex,
        displayValue: cell.displayValue,
        rowSpan: merge ? merge.endRow - merge.startRow + 1 : 1,
        colSpan: merge ? merge.endCol - merge.startCol + 1 : 1,
        hidden: false,
        style: cell.style,
      };
    }),
  );
}

export function updateSourceCell(
  doc: SourceDocument,
  sheetIndex: number,
  row: number,
  col: number,
  displayValue: string,
): SourceDocument {
  const sheets = doc.sheets.map((sheet, index) => {
    if (index !== sheetIndex) return sheet;
    const rows = sheet.rows.map((sourceRow, rowIndex) => {
      if (rowIndex !== row) return sourceRow;
      return sourceRow.map((cell, colIndex) =>
        colIndex === col ? { ...cell, displayValue } : cell,
      );
    });
    return { ...sheet, rows };
  });

  return { ...doc, sheets };
}
