import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractPdfBuffer } from "./pdf-extractor";
import { extractDocxBuffer } from "./docx-extractor";
import { extractTextFromBuffer } from "./extract-document";

async function testDocxFixture() {
  const filePath = path.resolve(process.cwd(), "tests/validation/documents_divers/exemple.docx");
  if (!fs.existsSync(filePath)) {
    console.log("DOCX fixture test: skipped (exemple.docx absent — lancez scripts/generate-import-fixtures.ts)");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const result = await extractDocxBuffer(buffer);
  assert.ok(result.textLength > 20, `DOCX textLength=${result.textLength}`);
  assert.equal(result.extractionMethod, "docx-text");
  assert.match(result.text, /Flora|Programmation/i);
}

async function testPngFixture() {
  const filePath = path.resolve(process.cwd(), "tests/validation/documents_divers/exemple.png");
  if (!fs.existsSync(filePath)) {
    console.log("PNG fixture test: skipped (exemple.png absent)");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const result = await extractTextFromBuffer(buffer, "exemple.png");
  assert.equal(result.extractionMethod, "ocr-image");
  assert.ok(result.textLength > 5, `PNG OCR textLength=${result.textLength}`);
}

async function testScannedPdfFixture() {
  const filePath = path.resolve(process.cwd(), "tests/validation/documents_divers/scan_ocr_test.pdf");
  if (!fs.existsSync(filePath)) {
    console.log("PDF scanné test: skipped (scan_ocr_test.pdf absent)");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const result = await extractPdfBuffer(buffer);
  assert.ok(result.textLength > 10, `scan textLength=${result.textLength}`);
  assert.equal(result.usedOcr, true, "Le PDF image-only doit déclencher l'OCR");
  assert.equal(result.pdfKind, "scanned");
}

async function main() {
  await testDocxFixture();
  await testPngFixture();
  await testScannedPdfFixture();
  console.log("Import fixture tests: OK");
}

main().catch((error) => {
  console.error("Import fixture tests: FAIL", error);
  process.exit(1);
});
