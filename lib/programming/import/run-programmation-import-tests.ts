import assert from "node:assert/strict";
import { PROGRAMMATION_IMPORT_BATCH_LIMITS, formatBatchLimitsLabel } from "./batch-limits";
import { findDuplicateFiles, validateBatchFiles } from "./batch-validation";
import { mergeProgrammationPages } from "./merge-programmation-pages";
import type { ParsedProgrammationImport } from "./types";

function parsedStub(fileName: string, rows: ParsedProgrammationImport["rows"]): ParsedProgrammationImport {
  return {
    format: "image",
    fileName,
    discipline: "Mathématiques",
    niveau: "CM2",
    rows,
    warnings: [],
    columns: ["Semaine", "Séance", "Compétence"],
    previewRows: [],
    rowCount: rows.length,
    needsColumnMapping: false,
    detectedFields: {},
    extractedTextPreview: "",
  };
}

function row(seance: string, week = "S1"): ParsedProgrammationImport["rows"][number] {
  return {
    id: `row-${seance}`,
    periodNumber: 1,
    weekNumber: 1,
    weekLabel: week,
    discipline: "Mathématiques",
    niveau: "CM2",
    sequence: "",
    seance,
    objectif: "",
    competences: [],
    notions: [],
    materiel: [],
    ressources: [],
    remarques: "",
    deroulement: "",
    evaluation: "",
    differenciation: "",
    domaine: "",
    rawLine: seance,
  };
}

function testBatchLimits() {
  assert.equal(PROGRAMMATION_IMPORT_BATCH_LIMITS.maxFiles, 20);
  assert.match(formatBatchLimitsLabel(), /20 pages/);
}

function testDuplicateDetection() {
  const existing = [{ name: "p1.png", size: 100, lastModified: 1 }];
  const incoming = [{ name: "p1.png", size: 100, lastModified: 1 }];
  assert.deepEqual(findDuplicateFiles(existing, incoming), ["p1.png"]);
}

function testMergeMultiplePagesIntoSingleProgrammation() {
  const merged = mergeProgrammationPages("batch-1", [
    {
      pageOrder: 1,
      fileId: "f1",
      fileName: "p1.png",
      parsed: parsedStub("p1.png", [row("Séance A")]),
    },
    {
      pageOrder: 2,
      fileId: "f2",
      fileName: "p2.png",
      parsed: parsedStub("p2.png", [row("Séance B")]),
    },
  ]);

  assert.equal(merged.rowCount, 2);
  assert.equal(merged.batchMeta?.mergeMode, "single_document");
  assert.equal(merged.batchMeta?.sourceFiles.length, 2);
}

function testValidateBatchRejectsTooManyFiles() {
  const files = Array.from({ length: 21 }, (_, index) => ({
    name: `f${index}.png`,
    type: "image/png",
    size: 1024,
    lastModified: index,
  }));
  const result = validateBatchFiles(files);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /20/);
}

function runProgrammationImportTests() {
  testBatchLimits();
  testDuplicateDetection();
  testMergeMultiplePagesIntoSingleProgrammation();
  testValidateBatchRejectsTooManyFiles();
  console.log("Programmation import tests: 4/4 passed");
}

runProgrammationImportTests();
