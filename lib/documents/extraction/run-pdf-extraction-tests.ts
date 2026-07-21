import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractPdfBuffer } from "./pdf-extractor";
import { isLikelyScannedPdfHeuristic } from "./pdf-heuristics";

function testScannedHeuristic() {
  assert.equal(isLikelyScannedPdfHeuristic("", 10, 0), true);
  assert.equal(isLikelyScannedPdfHeuristic("x".repeat(200), 5, 5), false);
  assert.equal(isLikelyScannedPdfHeuristic("court", 10, 1), true);
}

async function testGuidePdfExtraction() {
  const filePath = path.resolve(
    process.cwd(),
    "tests/validation/guides_maitre/MHM_CE1_CE2_GUIDE.pdf",
  );
  if (!fs.existsSync(filePath)) {
    console.log("PDF guide test: skipped (fixture absent)");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const result = await extractPdfBuffer(buffer);

  assert.equal(result.extractionMethod, "pdf-text");
  assert.equal(result.usedOcr, false);
  assert.equal(result.pdfKind, "text");
  assert.equal(result.hasTextLayer, true);
  assert.ok(result.textLength > 50_000, `textLength=${result.textLength}`);
  assert.ok((result.pageCount ?? 0) >= 40, `pageCount=${result.pageCount}`);
  assert.ok(result.diagnostics?.durationMs !== undefined);
}

async function testOptionalBoPdf() {
  let filePath = process.env.FLORA_VALIDATION_BO_PDF?.trim();
  if (filePath) filePath = path.resolve(filePath);
  else {
    const downloads = path.join(process.env.HOME ?? "", "Downloads");
    if (fs.existsSync(downloads)) {
      const match = fs
        .readdirSync(downloads)
        .find((name) => name.endsWith("-405261.pdf") || /405261\.pdf$/i.test(name));
      if (match) filePath = path.join(downloads, match);
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    console.log("PDF BO test: skipped (FLORA_VALIDATION_BO_PDF / ~/Downloads/*405261.pdf absent)");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const result = await extractPdfBuffer(buffer);

  assert.equal(result.usedOcr, false, "Un BO textuel ne doit pas déclencher l'OCR");
  assert.equal(result.pdfKind, "text");
  assert.ok(result.textLength > 1000, `textLength=${result.textLength}`);
}

async function main() {
  testScannedHeuristic();
  await testGuidePdfExtraction();
  await testOptionalBoPdf();
  console.log("PDF extraction tests: OK");
}

main().catch((error) => {
  console.error("PDF extraction tests: FAIL", error);
  process.exit(1);
});
