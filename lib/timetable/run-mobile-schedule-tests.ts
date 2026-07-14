import assert from "node:assert/strict";
import {
  adjacentMobileDay,
  buildMobileDaySummaries,
  getMobileScheduleDays,
  getSlotsForDay,
  isMobileBreakSlot,
  mobileScheduleContainerClassName,
  resolveInitialMobileDay,
} from "./mobile-schedule-utils";
import type { SmartTimetableSlot, TimetableSettings } from "./types";

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

const baseSettings: TimetableSettings = {
  schoolDays: ["Lundi", "Mardi", "Jeudi", "Vendredi"],
  morningStart: "08:30",
  morningEnd: "11:30",
  lunchBreak: { start: "11:30", end: "13:30" },
  afternoonStart: "13:30",
  afternoonEnd: "16:30",
  recesses: [],
  defaultSessionMinutes: 45,
  maxSessionsPerDay: 8,
  constraints: [],
  rooms: [],
  intervenants: [],
  decloisonnements: [],
  apcSlots: [],
};

function testMobileShowsSingleDaySlots() {
  const slots = [
    slot("1", "Lundi", "08:30", "09:00", "Rituels", "rituel"),
    slot("2", "Lundi", "09:00", "10:00", "Mathématiques"),
    slot("3", "Mardi", "09:00", "10:00", "Français"),
  ];

  const monday = getSlotsForDay(slots, "Lundi");
  assert.equal(monday.length, 2);
  assert.equal(monday[0]?.subject, "Rituels");
  assert.equal(getSlotsForDay(slots, "Mardi").length, 1);
}

function testMobileContainerDoesNotForceHorizontalOverflow() {
  const className = mobileScheduleContainerClassName();
  assert.match(className, /overflow-x-hidden/);
  assert.match(className, /max-w-full/);
}

function testBreakSlotsAreCompactCandidates() {
  assert.equal(isMobileBreakSlot({ slotType: "recreation" }), true);
  assert.equal(isMobileBreakSlot({ slotType: "pause_meridienne" }), true);
  assert.equal(isMobileBreakSlot({ slotType: "seance" }), false);
}

function testDayNavigationAndSessionDefaults() {
  const days = getMobileScheduleDays(baseSettings);
  assert.deepEqual(days, ["Lundi", "Mardi", "Jeudi", "Vendredi"]);
  assert.equal(resolveInitialMobileDay(days, "Jeudi", "Lundi"), "Jeudi");
  assert.equal(resolveInitialMobileDay(days, null, "Mercredi"), "Lundi");
  assert.equal(adjacentMobileDay(days, "Mardi", 1), "Jeudi");
  assert.equal(adjacentMobileDay(days, "Lundi", -1), "Lundi");
}

function testWeeklySummaryCards() {
  const slots = [
    slot("1", "Lundi", "08:30", "16:30", "Rituels", "rituel"),
    slot("2", "Lundi", "09:00", "10:00", "Mathématiques"),
    slot("3", "Mardi", "09:00", "10:00", "Français"),
  ];

  const summaries = buildMobileDaySummaries(slots, baseSettings);
  const monday = summaries.find((item) => item.day === "Lundi");
  assert.equal(monday?.slotCount, 2);
  assert.equal(monday?.startTime, "08:30");
  assert.equal(monday?.endTime, "16:30");
}

function testMobileSlotsEmbedTimesInCards() {
  const monday = getSlotsForDay([slot("1", "Lundi", "08:30", "09:00", "Rituels", "rituel")], "Lundi");
  assert.equal(monday[0]?.start, "08:30");
  assert.equal(monday[0]?.end, "09:00");
}

function runMobileScheduleTests() {
  testMobileShowsSingleDaySlots();
  testMobileContainerDoesNotForceHorizontalOverflow();
  testBreakSlotsAreCompactCandidates();
  testDayNavigationAndSessionDefaults();
  testWeeklySummaryCards();
  testMobileSlotsEmbedTimesInCards();
  console.log("Mobile schedule tests: 6/6 passed");
}

runMobileScheduleTests();
