import assert from "node:assert/strict";
import type { SmartTimetableSlot } from "./types";
import {
  EXPORT_BREAK_CARD_HEIGHT,
  EXPORT_LESSON_CARD_HEIGHT,
  resolveExportCardHeight,
} from "./export/export-card-dimensions";
import { buildUniformExportGrid, estimateExportPageCount } from "./export/export-grid-layout";

function slot(
  partial: Partial<SmartTimetableSlot> & Pick<SmartTimetableSlot, "day" | "start">,
): SmartTimetableSlot {
  return {
    id: partial.id ?? `slot-${partial.day}-${partial.start}`,
    scheduleId: partial.scheduleId ?? "schedule-1",
    day: partial.day,
    start: partial.start,
    end: partial.end ?? "09:30",
    subject: partial.subject ?? "Mathématiques",
    subSubject: partial.subSubject ?? "",
    customText: partial.customText ?? "",
    slotType: partial.slotType ?? "seance",
    color: partial.color ?? "",
    gradient: partial.gradient ?? "",
    lockLevel: partial.lockLevel ?? "none",
    hours: partial.hours ?? 1,
    room: partial.room ?? "",
    intervenant: partial.intervenant ?? "",
    label: partial.label ?? "",
    sortOrder: partial.sortOrder ?? 0,
    metadata: partial.metadata ?? {},
  };
}

function testUniformLessonHeights() {
  const grid = buildUniformExportGrid(
    [
      slot({ day: "Lundi", start: "08:45", end: "09:30", subject: "Mathématiques" }),
      slot({ day: "Mardi", start: "08:45", end: "10:00", subject: "Français", subSubject: "Lecture" }),
    ],
    ["Lundi", "Mardi"],
  );

  assert.equal(grid.rows.length, 1);
  assert.equal(grid.rows[0]?.rowHeightPx, EXPORT_LESSON_CARD_HEIGHT);
}

function testBreakCardsUseCompactHeight() {
  const grid = buildUniformExportGrid(
    [
      slot({ day: "Lundi", start: "10:00", slotType: "recreation", subject: "Récréation" }),
      slot({ day: "Lundi", start: "12:00", slotType: "pause_meridienne", subject: "Pause méridienne", end: "13:30" }),
    ],
    ["Lundi"],
  );

  assert.equal(resolveExportCardHeight("recreation"), EXPORT_BREAK_CARD_HEIGHT);
  assert.equal(grid.rows[0]?.rowHeightPx, EXPORT_BREAK_CARD_HEIGHT);
  assert.equal(grid.rows[1]?.rowHeightPx, EXPORT_BREAK_CARD_HEIGHT);
}

function testPaginationWhenContentOverflows() {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    rowHeightPx: EXPORT_LESSON_CARD_HEIGHT,
    start: `0${8 + index}:00`.slice(-5),
    end: "09:30",
    cells: [],
  }));

  const totalHeightPx = rows.reduce((sum, row) => sum + row.rowHeightPx + 4, 0);
  const pages = estimateExportPageCount({ totalHeightPx, availableHeightPx: 1200 });
  assert.ok(pages > 1);
}

function runExportGridLayoutTests() {
  testUniformLessonHeights();
  testBreakCardsUseCompactHeight();
  testPaginationWhenContentOverflows();
  console.log("Export grid layout tests: 3/3 passed");
}

runExportGridLayoutTests();
