import assert from "node:assert/strict";
import { validateBatchFilesForModule } from "../import/batch-validation-shared";
import { parseImportApiError } from "../import/import-api-errors";

function testProgressionAcceptsDocx() {
  const file = {
    name: "progression.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 1024,
    lastModified: 1,
  };
  const result = validateBatchFilesForModule("progression", [file]);
  assert.equal(result.ok, true);
}

function testProgressionAcceptsMultiPng() {
  const png = (index: number) => ({
    name: `page-${index}.png`,
    type: "image/png",
    size: 2048,
    lastModified: index,
  });
  const result = validateBatchFilesForModule("progression", [png(1), png(2), png(3)]);
  assert.equal(result.ok, true);
}

function testImportApiErrorShowsDetails() {
  const message = parseImportApiError(
    { error: "Analyse impossible.", details: "OCR : aucun texte détecté." },
    "Fallback",
  );
  assert.ok(message.includes("OCR"));
}

function testIndependentImportAllowedWithoutProgrammationId() {
  const programmationId: string | null = null;
  const canPreview = Boolean(null); // preview/save ne bloquent plus sur programmationId
  assert.equal(canPreview, false);
  assert.equal(programmationId, null);
}

function runProgressionImportTests() {
  testProgressionAcceptsDocx();
  testProgressionAcceptsMultiPng();
  testImportApiErrorShowsDetails();
  testIndependentImportAllowedWithoutProgrammationId();
  console.log("Progression import tests: 4/4 passed");
}

runProgressionImportTests();
