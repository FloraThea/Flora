import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { compareSourceDocuments } from "./compare-source-document";
import { buildFaithfulTableModel, updateSourceCell, type SourceDocument } from "./source-document";
import { exportSourceDocumentToExcelBuffer } from "./source-document-export";

function extractSourceDocumentFromWorkbook(buffer: Buffer, fileName: string): SourceDocument {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const sheets = workbook.SheetNames.map((name, index) => {
    const sheet = workbook.Sheets[name];
    const ref = sheet["!ref"];
    if (!ref) {
      return {
        name,
        activeForParse: index === 0,
        rowCount: 0,
        colCount: 0,
        rangeStartRow: 0,
        rangeStartCol: 0,
        mergedRanges: [],
        rows: [],
      };
    }

    const range = XLSX.utils.decode_range(ref);
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        row.push({ displayValue: cell?.w ?? (cell?.v === undefined ? "" : String(cell.v)) });
      }
      rows.push(row);
    }

    return {
      name,
      activeForParse: index === 0,
      rowCount: range.e.r - range.s.r + 1,
      colCount: range.e.c - range.s.c + 1,
      rangeStartRow: range.s.r,
      rangeStartCol: range.s.c,
      mergedRanges: [],
      rows,
    };
  });

  return {
    version: 1,
    fileName,
    format: "excel",
    importedAt: new Date().toISOString(),
    activeSheetIndex: 0,
    sheets,
  };
}

function testFaithfulMergeRendering() {
  const sheet = {
    name: "Feuille 1",
    activeForParse: true,
    rowCount: 2,
    colCount: 2,
    rangeStartRow: 0,
    rangeStartCol: 0,
    mergedRanges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }],
    rows: [
      [{ displayValue: "Période 1" }, { displayValue: "" }],
      [{ displayValue: "Lundi" }, { displayValue: "Activité" }],
    ],
  };

  const model = buildFaithfulTableModel(sheet);
  assert.equal(model[0]?.[0]?.colSpan, 2);
  assert.equal(model[0]?.[1]?.hidden, true);
  assert.equal(model[1]?.[0]?.displayValue, "Lundi");
}

function testUpdateSourceCellPreservesStructure() {
  const doc = {
    version: 1 as const,
    fileName: "test.xlsx",
    format: "excel" as const,
    importedAt: new Date().toISOString(),
    activeSheetIndex: 0,
    sheets: [
      {
        name: "Feuille 1",
        activeForParse: true,
        rowCount: 1,
        colCount: 1,
        rangeStartRow: 0,
        rangeStartCol: 0,
        mergedRanges: [],
        rows: [[{ displayValue: "Avant" }]],
      },
    ],
  };

  const updated = updateSourceCell(doc, 0, 0, 0, "Après");
  assert.equal(updated.sheets[0]?.rows[0]?.[0]?.displayValue, "Après");
  assert.equal(updated.sheets[0]?.rowCount, 1);
}

function testCompareDetectsRenamedColumn() {
  const expected = {
    version: 1 as const,
    fileName: "a.xlsx",
    format: "excel" as const,
    importedAt: new Date().toISOString(),
    activeSheetIndex: 0,
    sheets: [
      {
        name: "Prog",
        activeForParse: true,
        rowCount: 1,
        colCount: 1,
        rangeStartRow: 0,
        rangeStartCol: 0,
        mergedRanges: [],
        rows: [[{ displayValue: "Compétences travaillées" }]],
      },
    ],
  };

  const actual = updateSourceCell(expected, 0, 0, 0, "Compétence");
  const result = compareSourceDocuments(expected, actual);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "cell_value"));
}

function testExcelRoundTripPreservesSheetNames() {
  const samplePath = path.join(process.cwd(), "tests/validation/fixtures/programmation-hda.xlsx");
  if (!fs.existsSync(samplePath)) {
    console.log("Source document tests: skipped Excel fixture (programmation-hda.xlsx absent)");
    return;
  }

  const buffer = fs.readFileSync(samplePath);
  const extracted = extractSourceDocumentFromWorkbook(buffer, "programmation-hda.xlsx");
  assert.ok(extracted.sheets.length > 0);

  const exported = exportSourceDocumentToExcelBuffer(extracted);
  assert.ok(exported.byteLength > 0);

  const roundTrip = extractSourceDocumentFromWorkbook(exported, "roundtrip.xlsx");
  const comparison = compareSourceDocuments(extracted, roundTrip);
  assert.equal(comparison.ok, true, comparison.issues.map((issue) => issue.message).join("\n"));
}

function runSourceDocumentTests() {
  testFaithfulMergeRendering();
  testUpdateSourceCellPreservesStructure();
  testCompareDetectsRenamedColumn();
  testExcelRoundTripPreservesSheetNames();
  console.log("Source document tests: passed");
}

runSourceDocumentTests();
