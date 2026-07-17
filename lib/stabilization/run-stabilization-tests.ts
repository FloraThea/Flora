import assert from "node:assert/strict";
import { EMPTY_TIMETABLE } from "@/app/programmation/types";
import { payloadToTimetableInput } from "@/lib/timetable/timetable-input-utils";
import { UNIFIED_IMPORT_ACCEPT, UNIFIED_IMPORT_MODULES } from "@/lib/import/unified-import-engine";

function testEmptyTimetableHasNoDemoSlots() {
  assert.equal(EMPTY_TIMETABLE.slots.length, 0);
  assert.deepEqual(EMPTY_TIMETABLE.weeklyHoursBySubject, {});
}

function testPayloadToTimetableInput() {
  const input = payloadToTimetableInput([
    { day: "Lundi", start: "08:30", end: "10:30", subject: "Français" },
    { day: "Lundi", start: "10:45", end: "11:45", subject: "Mathématiques" },
  ]);
  assert.equal(input.slots.length, 2);
  assert.equal(input.weeklyHoursBySubject.Français, 2);
  assert.equal(input.weeklyHoursBySubject.Mathématiques, 1);
}

function testUnifiedImportAcceptIncludesCoreFormats() {
  for (const format of ["png", "jpg", "jpeg", "pdf", "docx", "xlsx"]) {
    assert.equal(UNIFIED_IMPORT_ACCEPT.includes(format), true, format);
  }
}

function testImportEngineRegistry() {
  assert.equal(UNIFIED_IMPORT_MODULES.length, 4);
  for (const moduleName of UNIFIED_IMPORT_MODULES) {
    assert.equal(["programmation", "progression", "timetable", "document"].includes(moduleName), true);
  }
}

function run() {
  testEmptyTimetableHasNoDemoSlots();
  testPayloadToTimetableInput();
  testUnifiedImportAcceptIncludesCoreFormats();
  testImportEngineRegistry();
  console.log("Stabilization tests: 4/4 passed");
}

run();
