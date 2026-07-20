import * as XLSX from "xlsx";
import type { SourceDocument } from "./source-document";

export function exportSourceDocumentToWorkbook(document: SourceDocument): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  for (const sheet of document.sheets) {
    const grid = sheet.rows.map((row) => row.map((cell) => cell.displayValue));
    const worksheet = XLSX.utils.aoa_to_sheet(grid);

    for (const merge of sheet.mergedRanges) {
      worksheet["!merges"] = worksheet["!merges"] ?? [];
      worksheet["!merges"].push({
        s: { r: merge.startRow, c: merge.startCol },
        e: { r: merge.endRow, c: merge.endCol },
      });
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  return workbook;
}

export function exportSourceDocumentToExcelBuffer(document: SourceDocument): Buffer {
  const workbook = exportSourceDocumentToWorkbook(document);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function downloadSourceDocumentExcel(sourceDocument: SourceDocument, fileName: string) {
  const buffer = exportSourceDocumentToExcelBuffer(sourceDocument);
  const blob = new Blob([Uint8Array.from(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printFaithfulTable(containerId: string) {
  const node = window.document.getElementById(containerId);
  if (!node) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Impression Flora</title>
        <style>
          body { font-family: sans-serif; padding: 16px; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ccc; padding: 6px; vertical-align: top; white-space: pre-wrap; }
        </style>
      </head>
      <body>${node.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
