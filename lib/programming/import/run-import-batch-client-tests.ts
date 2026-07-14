import assert from "node:assert/strict";
import {
  ImportFileRegistry,
  canUseApiUpload,
  mapImportFailureMessage,
  parseImportApiError,
  shouldUseDirectUpload,
} from "./import-batch-client";
import {
  PROGRAMMING_IMPORT_API_BODY_LIMIT_BYTES,
  PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES,
} from "./batch-limits";

function testDirectUploadThreshold() {
  assert.equal(shouldUseDirectUpload(3 * 1024 * 1024), false);
  assert.equal(shouldUseDirectUpload(PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES), true);
}

function testApiBodyLimit() {
  assert.equal(canUseApiUpload(PROGRAMMING_IMPORT_API_BODY_LIMIT_BYTES), true);
  assert.equal(canUseApiUpload(PROGRAMMING_IMPORT_API_BODY_LIMIT_BYTES + 1), false);
}

function testParseApiErrorPrefersMessage() {
  assert.equal(parseImportApiError({ error: "Le lot d'import n'a pas pu être créé." }, "fallback"), "Le lot d'import n'a pas pu être créé.");
  assert.equal(parseImportApiError({ details: "bucket missing" }, "fallback"), "bucket missing");
}

function testMapImportFailureMessageByStep() {
  assert.match(mapImportFailureMessage("batch_create", ""), /lot d'import/i);
  assert.match(mapImportFailureMessage("upload-page-2", ""), /téléversement/i);
  assert.match(mapImportFailureMessage("analyze", ""), /analyse/i);
  assert.match(mapImportFailureMessage("merge", ""), /fusion/i);
}

function testImportFileRegistryKeepsFiles() {
  const registry = new ImportFileRegistry();
  const file = new File(["hello"], "page.png", { type: "image/png" });
  registry.set("client-1", file);
  assert.equal(registry.count(), 1);
  assert.equal(registry.get("client-1"), file);
  registry.delete("client-1");
  assert.equal(registry.has("client-1"), false);
}

function testMapImportFailureUsesRawMessage() {
  assert.equal(mapImportFailureMessage("upload-page-1", "Le téléversement vers le stockage a échoué."), "Le téléversement vers le stockage a échoué.");
}

function runImportBatchClientTests() {
  testDirectUploadThreshold();
  testApiBodyLimit();
  testParseApiErrorPrefersMessage();
  testMapImportFailureMessageByStep();
  testImportFileRegistryKeepsFiles();
  testMapImportFailureUsesRawMessage();
  console.log("Import batch client tests: 6/6 passed");
}

runImportBatchClientTests();
