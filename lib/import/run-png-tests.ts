import assert from "node:assert/strict";
import {
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_IMAGE_MIME_TYPES,
  getFileExtension,
  getFormatsAcceptesLabel,
  getModuleAcceptAttribute,
  isAcceptedForModule,
  isAcceptedResourceFile,
  isSupportedImageFile,
  validateImportFile,
} from "./accepted-formats";
import { MAX_UPLOAD_SIZE } from "@/lib/upload/max-upload-size";

const MODULES = [
  "bibliotheque",
  "referentiel_bo",
  "programmation",
  "progression",
  "sequence",
  "seance",
  "cahier_journal",
  "rituel",
  "emploi_du_temps",
  "ressource",
  "guide_pedagogique",
  "agenda_108h",
] as const;

function testPngExtensions() {
  assert.ok(isSupportedImageFile("scan.png"));
  assert.ok(isSupportedImageFile("scan.PNG"));
  assert.ok(isSupportedImageFile("photo.jpg"));
  assert.ok(isSupportedImageFile("photo.jpeg"));
  assert.ok(isSupportedImageFile("transparent.png", "image/png"));
  assert.ok(isSupportedImageFile("large.png", "image/png"));
  assert.equal(getFileExtension("TABLEAU.PNG"), ".png");
}

function testPngMimeTypes() {
  for (const mime of SUPPORTED_IMAGE_MIME_TYPES) {
    assert.ok(SUPPORTED_IMAGE_MIME_TYPES.includes(mime));
  }
  assert.ok(isSupportedImageFile("unknown", "image/png"));
  assert.ok(isSupportedImageFile("unknown", "image/jpeg"));
}

function testAllImportModulesAcceptPng() {
  for (const module of MODULES) {
    assert.ok(
      isAcceptedForModule(module, "document.png", "image/png"),
      `${module} must accept PNG`,
    );
    assert.ok(
      getModuleAcceptAttribute(module).includes(".png"),
      `${module} accept attribute must include .png`,
    );
    assert.ok(
      getFormatsAcceptesLabel(module).toLowerCase().includes("png"),
      `${module} help text must mention PNG`,
    );
  }
}

function testResourcePipelineAcceptsPng() {
  assert.ok(isAcceptedResourceFile("cahier.png", "image/png"));
  assert.ok(isAcceptedResourceFile("guide.JPG", "image/jpeg"));
}

function testValidationRejectsUnknownFormat() {
  const result = validateImportFile(
    "progression",
    { name: "file.exe", type: "application/octet-stream", size: 1024 },
    MAX_UPLOAD_SIZE,
  );
  assert.equal(result.ok, false);
}

function testValidationAcceptsPng() {
  const result = validateImportFile(
    "programmation",
    { name: "programmation.png", type: "image/png", size: 1024 },
    MAX_UPLOAD_SIZE,
  );
  assert.equal(result.ok, true);
}

function testSupportedImageExtensionsList() {
  assert.deepEqual(SUPPORTED_IMAGE_EXTENSIONS, [".jpg", ".jpeg", ".png"]);
}

function runPngImportTests() {
  testPngExtensions();
  testPngMimeTypes();
  testAllImportModulesAcceptPng();
  testResourcePipelineAcceptsPng();
  testValidationRejectsUnknownFormat();
  testValidationAcceptsPng();
  testSupportedImageExtensionsList();
  console.log("PNG import tests: 7/7 passed");
}

runPngImportTests();
