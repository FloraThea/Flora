import assert from "node:assert/strict";
import type { SmartTimetableSlot } from "./types";
import {
  buildScheduleGridModel,
  buildScheduleTimeScale,
  buildTimeAxisSegments,
  findOverlappingSlots,
  layoutSlotsOnScale,
  parseTimeToMinutes,
  durationToHeightPx,
} from "./schedule-grid-layout";
import { duplicateSlot } from "./slot-editor/operations";

function slot(
  id: string,
  day: string,
  start: string,
  end: string,
  subject = "Français",
): SmartTimetableSlot {
  return {
    id,
    scheduleId: "sched-1",
    day,
    start,
    end,
    subject,
    subSubject: "",
    customText: "",
    color: "",
    gradient: "",
    slotType: "seance",
    lockLevel: "none",
    hours: 1,
    room: "",
    intervenant: "",
    label: subject,
    sortOrder: 0,
    metadata: {},
  };
}

const results: Array<{ name: string; ok: boolean; error?: string }> = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, error: message });
    console.error(`✗ ${name}: ${message}`);
  }
}

test("aligns same start times across days on shared scale", () => {
  const slots = [
    slot("1", "Lundi", "08:30", "09:30"),
    slot("2", "Mardi", "08:30", "09:30"),
    slot("3", "Mercredi", "08:30", "09:00"),
  ];
  const grid = buildScheduleGridModel(slots, ["Lundi", "Mardi", "Mercredi"]);
  const lundi = grid.positioned.find((p) => p.slot.id === "1");
  const mardi = grid.positioned.find((p) => p.slot.id === "2");
  assert.ok(lundi && mardi);
  assert.equal(lundi.topPx, mardi.topPx);
});

test("height is proportional to duration", () => {
  const scale = buildScheduleTimeScale([
    slot("1", "Lundi", "08:30", "09:00"),
    slot("2", "Lundi", "09:00", "10:00"),
  ]);
  const h15 = durationToHeightPx(15, scale);
  const h30 = durationToHeightPx(30, scale);
  const h60 = durationToHeightPx(60, scale);
  assert.ok(h60 > h30);
  assert.ok(h30 > h15);
  assert.ok(h15 < 25, "15 min slot should not be inflated to 52px");
});

test("short adjacent slots do not overlap in layout", () => {
  const slots = [
    slot("1", "Lundi", "08:30", "08:45"),
    slot("2", "Lundi", "08:45", "09:10"),
    slot("3", "Lundi", "09:10", "10:00"),
  ];
  const positioned = layoutSlotsOnScale(slots, buildScheduleTimeScale(slots));
  const first = positioned[0];
  const second = positioned[1];
  assert.ok(first.topPx + first.heightPx <= second.topPx + 1);
});

test("supports irregular time boundaries", () => {
  const slots = [
    slot("1", "Lundi", "08:30", "08:45"),
    slot("2", "Lundi", "08:45", "09:30"),
    slot("3", "Lundi", "09:30", "10:00"),
    slot("4", "Lundi", "10:15", "11:00"),
  ];
  const positioned = layoutSlotsOnScale(slots, buildScheduleTimeScale(slots));
  assert.equal(positioned.length, 4);
  const gap = positioned[3].topPx - (positioned[2].topPx + positioned[2].heightPx);
  assert.ok(gap > 0, "gap between 10:00 and 10:15 should be visible");
});

test("time axis segments cover lunch as single block", () => {
  const slots = [
    slot("1", "Lundi", "11:30", "13:30", "Déjeuner"),
    slot("2", "Lundi", "08:30", "09:00"),
  ];
  const scale = buildScheduleTimeScale(slots);
  const segments = buildTimeAxisSegments(slots, scale);
  const lunchSegment = segments.find(
    (segment) => segment.startMinutes === parseTimeToMinutes("11:30"),
  );
  assert.ok(lunchSegment);
  assert.equal(lunchSegment.endMinutes, parseTimeToMinutes("13:30"));
  assert.ok(lunchSegment.heightPx > 100);
});

test("detects overlapping slots on same day", () => {
  const overlaps = findOverlappingSlots([
    slot("1", "Lundi", "08:30", "09:30"),
    slot("2", "Lundi", "09:00", "10:00"),
  ]);
  assert.equal(overlaps.length, 1);
});

test("parseTimeToMinutes handles HH:MM", () => {
  assert.equal(parseTimeToMinutes("08:30"), 510);
  assert.equal(parseTimeToMinutes("10:15"), 615);
});

test("duplicateSlot creates unique id and preserves content", () => {
  const source = slot("src", "Lundi", "08:30", "09:30", "Mathématiques");
  source.subSubject = "Numération";
  source.customText = "Groupe A";
  source.color = "#9caf88";
  const copy = duplicateSlot(source, "sched-1");
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.subject, source.subject);
  assert.equal(copy.subSubject, source.subSubject);
  assert.equal(copy.customText, source.customText);
  assert.equal(copy.color, source.color);
});

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\n${results.length} grid tests passed`);
