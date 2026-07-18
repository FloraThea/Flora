import assert from "node:assert/strict";
import { computeSlotCardTypography } from "@/lib/timetable/slot-card-typography";
import { buildScheduleGridModel } from "@/lib/timetable/schedule-grid-layout";
import { resolveSlotCardDisplay } from "@/lib/timetable/slot-display";
import { duplicateSlot } from "@/lib/timetable/slot-editor/operations";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { createDefaultTimetableSettings } from "@/lib/timetable/types";

function slot(partial: Partial<SmartTimetableSlot>): SmartTimetableSlot {
  return {
    id: partial.id ?? "s1",
    scheduleId: "sched",
    day: partial.day ?? "Lundi",
    start: partial.start ?? "08:30",
    end: partial.end ?? "09:00",
    subject: partial.subject ?? "Français",
    subSubject: partial.subSubject ?? "",
    customText: partial.customText ?? "",
    color: "",
    gradient: "",
    slotType: "seance",
    lockLevel: "none",
    hours: 0.5,
    room: "",
    intervenant: "",
    label: partial.subject ?? "Français",
    sortOrder: 0,
    metadata: {},
  };
}

function testComplementaryAlwaysVisibleInTypography() {
  const typography = computeSlotCardTypography(36);
  assert.equal(typography.showComplementaryText, true);
  assert.equal(typography.showSecondary, false);
}

function testComplementaryInDisplay() {
  const display = resolveSlotCardDisplay(slot({ customText: "Groupe A — MHM" }));
  assert.equal(display.complementaryText, "Groupe A — MHM");
}

function testGridMinHeightWithComplementary() {
  const settings: TimetableSettings = createDefaultTimetableSettings();
  const slots = [slot({ customText: "Atelier lecture", start: "08:30", end: "08:45" })];
  const grid = buildScheduleGridModel(slots, settings.schoolDays, settings);
  const positioned = grid.positioned[0];
  assert.ok(positioned);
  assert.ok(positioned.heightPx >= 56);
  assert.equal(positioned.compact, false);
}

function testDuplicatePreservesComplementary() {
  const copy = duplicateSlot(slot({ customText: "Consignes" }), "sched-2");
  assert.equal(copy.customText, "Consignes");
}

function run() {
  testComplementaryAlwaysVisibleInTypography();
  testComplementaryInDisplay();
  testGridMinHeightWithComplementary();
  testDuplicatePreservesComplementary();
  console.log("Complementary text tests: 4/4 passed");
}

run();
