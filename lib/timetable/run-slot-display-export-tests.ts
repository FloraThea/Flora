import assert from "node:assert/strict";
import type { SmartTimetableSlot } from "./types";
import {
  buildExportCardContentLines,
  resolveSlotCardDisplay,
  resolveSlotComplementaryText,
} from "./slot-display";
import {
  EXPORT_SCHEDULE_FONT_SIZE_PX,
  EXPORT_SCHEDULE_TIME_FONT_SIZE_PX,
  computeUniformPrintTypography,
} from "./slot-card-typography";
import { buildCardContentLines } from "./export/print-theme";
import { duplicateSlot } from "./slot-editor/operations";

function slot(overrides: Partial<SmartTimetableSlot> = {}): SmartTimetableSlot {
  return {
    id: "s1",
    scheduleId: "sched-1",
    day: "Lundi",
    start: "08:45",
    end: "09:30",
    subject: "Mathématiques",
    subSubject: "Nombres et calcul",
    customText: "MHM – séance 3",
    color: "",
    gradient: "",
    slotType: "seance",
    lockLevel: "none",
    hours: 1,
    room: "",
    intervenant: "",
    label: "Mathématiques",
    sortOrder: 0,
    metadata: { levels: ["CM2"] },
    ...overrides,
  };
}

function testComplementaryTextField() {
  const source = slot();
  assert.equal(resolveSlotComplementaryText(source), "MHM – séance 3");
}

function testDisplayOrder() {
  const display = resolveSlotCardDisplay(slot());
  assert.equal(display.subject, "Mathématiques");
  assert.equal(display.subSubject, "Nombres et calcul");
  assert.equal(display.complementaryText, "MHM – séance 3");
  assert.deepEqual(display.levels, ["CM2"]);
}

function testExportContentLinesOrder() {
  const lines = buildExportCardContentLines({
    subject: "Mathématiques",
    subSubject: "Nombres et calcul",
    complementaryText: "MHM – séance 3",
  });
  assert.deepEqual(
    lines.map((line) => line.text),
    ["Mathématiques", "Nombres et calcul", "MHM – séance 3"],
  );
}

function testPrintThemeContentLinesOrder() {
  const lines = buildCardContentLines({
    subject: "Mathématiques",
    subSubject: "Nombres et calcul",
    complementaryText: "MHM – séance 3",
    showComplementaryText: true,
    showObjectives: false,
    showCompetencies: false,
  });
  assert.deepEqual(
    lines.map((line) => line.text),
    ["Mathématiques", "Nombres et calcul", "MHM – séance 3"],
  );
}

function testExportFontSizeConstant() {
  const compact = computeUniformPrintTypography(true);
  const tall = computeUniformPrintTypography(false);
  assert.equal(compact.subjectPx, EXPORT_SCHEDULE_FONT_SIZE_PX);
  assert.equal(tall.subjectPx, EXPORT_SCHEDULE_FONT_SIZE_PX);
  assert.equal(compact.secondaryPx, EXPORT_SCHEDULE_FONT_SIZE_PX);
  assert.equal(tall.timePx, EXPORT_SCHEDULE_TIME_FONT_SIZE_PX);
  assert.equal(compact.showSecondary, true);
  assert.equal(tall.showTertiary, true);
}

function testDuplicatePreservesComplementaryText() {
  const copy = duplicateSlot(slot(), "sched-1");
  assert.equal(copy.customText, "MHM – séance 3");
  assert.equal(copy.subSubject, "Nombres et calcul");
}

function testEmptyComplementaryText() {
  const display = resolveSlotCardDisplay(slot({ customText: "" }));
  assert.equal(display.complementaryText, "");
}

function runSlotDisplayExportTests() {
  testComplementaryTextField();
  testDisplayOrder();
  testExportContentLinesOrder();
  testPrintThemeContentLinesOrder();
  testExportFontSizeConstant();
  testDuplicatePreservesComplementaryText();
  testEmptyComplementaryText();
  console.log("Slot display/export tests: 7/7 passed");
}

runSlotDisplayExportTests();
