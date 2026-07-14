import assert from "node:assert/strict";
import type { SmartTimetableSlot } from "./types";
import {
  VISUAL_BREAK_DURATION_MINUTES,
  buildScheduleGridModel,
  buildScheduleTimeScale,
  buildTimelineSegments,
  durationToHeightPx,
  findOverlappingSlots,
  getVisualDurationMinutes,
  layoutSlotsOnScale,
  parseTimeToMinutes,
} from "./schedule-grid-layout";
import {
  SCHEDULE_SUBJECT_FONT_SIZE_PX,
  SCHEDULE_TIME_FONT_SIZE_PX,
  computeSlotCardTypography,
} from "./slot-card-typography";
import { duplicateSlot } from "./slot-editor/operations";

function slot(
  id: string,
  day: string,
  start: string,
  end: string,
  subject = "Français",
  slotType: SmartTimetableSlot["slotType"] = "seance",
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
    slotType,
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

test("height is proportional to duration for lessons", () => {
  const scale = buildScheduleTimeScale([
    slot("1", "Lundi", "08:30", "09:00"),
    slot("2", "Lundi", "09:00", "10:00"),
  ]);
  const h15 = durationToHeightPx(15, scale);
  const h30 = durationToHeightPx(30, scale);
  const h60 = durationToHeightPx(60, scale);
  assert.ok(h60 > h30);
  assert.ok(h30 > h15);
});

test("15 minute recess uses 30 minute visual height", () => {
  const recess = slot("r", "Lundi", "10:00", "10:15", "Récréation", "recreation");
  assert.equal(getVisualDurationMinutes(recess), VISUAL_BREAK_DURATION_MINUTES);
  const scale = buildScheduleTimeScale([recess]);
  const positioned = layoutSlotsOnScale([recess], scale);
  assert.equal(positioned[0].visualDurationMinutes, 30);
  assert.equal(positioned[0].durationMinutes, 15);
});

test("two hour lunch uses 30 minute visual height", () => {
  const lunch = slot("l", "Lundi", "11:30", "13:30", "Pause méridienne", "pause_meridienne");
  assert.equal(getVisualDurationMinutes(lunch), VISUAL_BREAK_DURATION_MINUTES);
  const scale = buildScheduleTimeScale([lunch, slot("1", "Lundi", "08:30", "09:00")]);
  const positioned = layoutSlotsOnScale([lunch], scale, buildTimelineSegments([lunch, slot("1", "Lundi", "08:30", "09:00")], scale));
  assert.equal(positioned[0].heightPx, durationToHeightPx(30, scale));
  assert.equal(positioned[0].durationMinutes, 120);
});

test("lunch segment is compressed on time axis", () => {
  const slots = [
    slot("l", "Lundi", "11:30", "13:30", "Pause méridienne", "pause_meridienne"),
    slot("1", "Lundi", "08:30", "09:00"),
  ];
  const scale = buildScheduleTimeScale(slots);
  const segments = buildTimelineSegments(slots, scale);
  const lunchSegment = segments.find(
    (segment) => segment.startMinutes === parseTimeToMinutes("11:30"),
  );
  assert.ok(lunchSegment);
  assert.equal(lunchSegment.endMinutes, parseTimeToMinutes("13:30"));
  assert.equal(lunchSegment.realDurationMinutes, 120);
  assert.equal(lunchSegment.visualDurationMinutes, 30);
  assert.ok(lunchSegment.heightPx < 50);
});

test("break days align across four weekdays", () => {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi"];
  const slots = days.flatMap((day, index) => [
    slot(`lesson-${index}`, day, "08:30", "10:00"),
    slot(`recess-${index}`, day, "10:00", "10:15", "Récréation", "recreation"),
    slot(`after-${index}`, day, "10:15", "11:00"),
  ]);
  const grid = buildScheduleGridModel(slots, days);
  const recessTops = days.map(
    (day) => grid.positioned.find((p) => p.day === day && p.slot.slotType === "recreation")?.topPx,
  );
  assert.ok(recessTops.every((top) => top === recessTops[0]));
});

test("short adjacent slots do not overlap in layout", () => {
  const slots = [
    slot("1", "Lundi", "08:30", "08:45"),
    slot("2", "Lundi", "08:45", "09:10"),
    slot("3", "Lundi", "09:10", "10:00"),
  ];
  const positioned = layoutSlotsOnScale(slots, buildScheduleTimeScale(slots), buildTimelineSegments(slots, buildScheduleTimeScale(slots)));
  const first = positioned[0];
  const second = positioned[1];
  assert.ok(first.topPx + first.heightPx <= second.topPx + 1);
});

test("detects overlapping slots on same day", () => {
  const overlaps = findOverlappingSlots([
    slot("1", "Lundi", "08:30", "09:30"),
    slot("2", "Lundi", "09:00", "10:00"),
  ]);
  assert.equal(overlaps.length, 1);
});

test("typography uses identical subject and time sizes", () => {
  const sizes = [15, 30, 45, 60, 90].map((minutes) =>
    computeSlotCardTypography(minutes * 1.25),
  );
  for (const typography of sizes) {
    assert.equal(typography.titlePx, SCHEDULE_SUBJECT_FONT_SIZE_PX);
    assert.equal(typography.timePx, SCHEDULE_TIME_FONT_SIZE_PX);
  }
  const recessTypography = computeSlotCardTypography(durationToHeightPx(30, buildScheduleTimeScale([])));
  assert.equal(recessTypography.titlePx, SCHEDULE_SUBJECT_FONT_SIZE_PX);
});

test("compact cards hide secondary info but keep font size", () => {
  const compact = computeSlotCardTypography(30);
  const large = computeSlotCardTypography(120);
  assert.equal(compact.titlePx, large.titlePx);
  assert.equal(compact.showSecondary, false);
  assert.equal(large.showSecondary, true);
});

test("duplicateSlot creates unique id and preserves content", () => {
  const source = slot("src", "Lundi", "08:30", "09:30", "Mathématiques");
  source.subSubject = "Numération";
  source.customText = "Groupe A";
  source.color = "#9caf88";
  const copy = duplicateSlot(source, "sched-1");
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.subject, source.subject);
});

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\n${results.length} grid tests passed`);
