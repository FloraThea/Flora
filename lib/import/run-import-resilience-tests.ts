/**
 * Tests résilience import — formats, fichiers invalides, messages d'erreur.
 */
import assert from "node:assert/strict";
import {
  getFileExtension,
  isAcceptedForModule,
  validateImportFile,
} from "@/lib/import/accepted-formats";
import { mapImportFailureMessage } from "@/lib/import/import-api-errors";
import { UNIFIED_IMPORT_ACCEPT } from "@/lib/import/unified-import-engine";

function testAcceptedFormats() {
  for (const ext of ["png", "jpg", "jpeg", "pdf", "docx", "xlsx"]) {
    assert.equal(UNIFIED_IMPORT_ACCEPT.includes(ext), true, ext);
  }
}

function testModuleValidation() {
  assert.equal(isAcceptedForModule("bibliotheque", "guide.pdf"), true);
  assert.equal(isAcceptedForModule("bibliotheque", "scan.jpg", "image/jpeg"), true);
  assert.equal(isAcceptedForModule("progression", "table.xlsx"), true);
  assert.equal(isAcceptedForModule("bibliotheque", "virus.exe"), false);
}

function testEmptyAndCorruptFile() {
  const empty = validateImportFile("bibliotheque", { name: "vide.pdf", type: "application/pdf", size: 0 }, 10_000_000);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /vide/i);

  const badExt = validateImportFile("programmation", { name: "bad.xyz", type: "", size: 100 }, 10_000_000);
  assert.equal(badExt.ok, false);
}

function testImportErrorMessages() {
  assert.match(mapImportFailureMessage("analyze", ""), /analyse/i);
  assert.match(mapImportFailureMessage("upload_chunk", ""), /téléversement/i);
  assert.match(mapImportFailureMessage("save", "Erreur SQL"), /Erreur SQL/);
  assert.equal(getFileExtension("Doc.PDF"), ".pdf");
}

function run() {
  testAcceptedFormats();
  testModuleValidation();
  testEmptyAndCorruptFile();
  testImportErrorMessages();
  console.log("Import resilience tests: 4/4 passed");
}

run();
