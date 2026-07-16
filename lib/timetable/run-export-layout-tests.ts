import assert from "node:assert/strict";
import {
  buildClassroomExportCardBlocks,
  shouldRenderComplementaryInline,
} from "./export/export-card-layout";
import {
  EXPORT_SCHEDULE_FONT_SIZE_PX,
  EXPORT_SCHEDULE_TIME_FONT_SIZE_PX,
  computeUniformPrintTypography,
} from "./slot-card-typography";
import { resolvePageDimensions } from "./export/types";

function testFontSizesFixedAt30() {
  const typography = computeUniformPrintTypography();
  assert.equal(typography.subjectPx, EXPORT_SCHEDULE_FONT_SIZE_PX);
  assert.equal(typography.secondaryPx, EXPORT_SCHEDULE_FONT_SIZE_PX);
  assert.equal(typography.timePx, EXPORT_SCHEDULE_TIME_FONT_SIZE_PX);
  assert.equal(EXPORT_SCHEDULE_FONT_SIZE_PX, 30);
  assert.ok(EXPORT_SCHEDULE_TIME_FONT_SIZE_PX >= 24 && EXPORT_SCHEDULE_TIME_FONT_SIZE_PX <= 28);
}

function testSubjectOnly() {
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "08:45 – 09:30",
    subject: "Mathématiques",
    showComplementaryText: true,
  });
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["time", "subject"],
  );
}

function testSubjectWithShortComplementaryInline() {
  assert.equal(shouldRenderComplementaryInline("Mathématiques", "MHM"), true);
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "08:45 – 09:30",
    subject: "Mathématiques",
    complementaryText: "MHM",
    showComplementaryText: true,
  });
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["time", "subjectInline"],
  );
}

function testSubjectWithLongComplementaryOnNewLine() {
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "08:45 – 09:30",
    subject: "Français",
    complementaryText: "Production d'écrits en autonomie",
    showComplementaryText: true,
  });
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["time", "subject", "complementary"],
  );
  const comp = blocks.find((b) => b.kind === "complementary");
  assert.ok(comp && comp.kind === "complementary");
  assert.equal(comp.text, "Production d'écrits en autonomie");
}

function testSubjectSubSubjectComplementary() {
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "10:00 – 11:00",
    subject: "Mathématiques",
    subSubject: "Nombres et calcul",
    complementaryText: "MHM – séance 3",
    showComplementaryText: true,
  });
  assert.equal(blocks[0]?.kind, "time");
  assert.ok(blocks.some((b) => b.kind === "subSubject"));
  assert.ok(blocks.some((b) => b.kind === "subjectInline" || b.kind === "complementary"));
}

function testNoEmptySubSubjectLine() {
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "08:45 – 09:30",
    subject: "EPS",
    subSubject: "",
    showComplementaryText: true,
  });
  assert.equal(blocks.some((b) => b.kind === "subSubject"), false);
}

function testComplementaryNeverRemovedWhenEnabled() {
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "08:45 – 09:30",
    subject: "Français",
    complementaryText: "Atelier lecture",
    showComplementaryText: true,
  });
  assert.ok(blocks.some((b) => b.kind === "subjectInline" || b.kind === "complementary"));
}

function testComplementaryHiddenOnlyWhenDisabled() {
  const blocks = buildClassroomExportCardBlocks({
    timeLabel: "08:45 – 09:30",
    subject: "Français",
    complementaryText: "Atelier lecture",
    showComplementaryText: false,
  });
  assert.equal(blocks.some((b) => b.kind === "complementary" || b.kind === "subjectInline"), false);
}

function testA3LandscapeDimensions() {
  const dims = resolvePageDimensions({ pageFormat: "a3", orientation: "landscape" });
  assert.equal(dims.width, 4961);
  assert.equal(dims.height, 3508);
}

function testA4LandscapeDimensions() {
  const dims = resolvePageDimensions({ pageFormat: "a4", orientation: "landscape" });
  assert.equal(dims.width, 3508);
  assert.equal(dims.height, 2480);
}

function runExportLayoutTests() {
  testFontSizesFixedAt30();
  testSubjectOnly();
  testSubjectWithShortComplementaryInline();
  testSubjectWithLongComplementaryOnNewLine();
  testSubjectSubSubjectComplementary();
  testNoEmptySubSubjectLine();
  testComplementaryNeverRemovedWhenEnabled();
  testComplementaryHiddenOnlyWhenDisabled();
  testA3LandscapeDimensions();
  testA4LandscapeDimensions();
  console.log("Export layout tests: 10/10 passed");
}

runExportLayoutTests();
