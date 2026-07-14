import assert from "node:assert/strict";
import { isNonPedagogicalSlot } from "./journal-slot-utils";
import type { JournalScheduleSlot } from "./journal-timetable";
import { dailyPlanner } from "./DailyPlanner";
import { lessonAssembler } from "./LessonAssembler";
import type { ResolvedSchoolDay } from "./ScheduleEngine";

function testBreakSlotsAreNonPedagogical() {
  assert.equal(isNonPedagogicalSlot("recreation"), true);
  assert.equal(isNonPedagogicalSlot("pause_meridienne"), true);
  assert.equal(isNonPedagogicalSlot("seance"), false);
}

function testEmptySlotHasNoPedagogicalContent() {
  const entry = lessonAssembler.buildEmptySlotEntry({
    journalId: "preview",
    sortOrder: 1,
    slot: {
      day: "Lundi",
      start: "08:45",
      end: "09:30",
      subject: "Mathématiques",
      hours: 1,
      subSubject: "Nombres",
      slotType: "seance",
      sourceScheduleSlotId: "slot-1",
    },
  });

  assert.equal(entry.objectif, "");
  assert.equal(entry.competence, "");
  assert.equal(entry.organisation, "");
  assert.equal(entry.materiel.items.length, 0);
  assert.equal(entry.metadata.fillState, "empty");
  assert.equal(entry.metadata.isPersisted, false);
  assert.equal(entry.slotData.subSubject, "Nombres");
}

function testBreakEntryIsSimple() {
  const resolvedDay: ResolvedSchoolDay = {
    date: "2026-09-07",
    dayName: "lundi",
    periodNumber: 1,
    weekNumber: 1,
    isHoliday: false,
    isVacation: false,
    slots: [
      {
        day: "Lundi",
        start: "10:00",
        end: "10:15",
        subject: "Récréation",
        hours: 0.25,
        slotType: "recreation",
      } as JournalScheduleSlot,
    ],
  };

  const entries = dailyPlanner.planDay({
    journalId: "preview",
    resolvedDay,
    profile: {
      profile: {
        id: "p1",
        metadata: {},
        workingDays: ["lundi"],
      },
    } as never,
    seances: [],
    resourcesByMatiere: {},
    linkSeances: false,
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].entryType, "break");
  assert.equal(entries[0].objectif, "");
  assert.equal(entries[0].metadata.fillState, "break");
}

function testPlannerDoesNotInventSeanceContentWithoutLink() {
  const resolvedDay: ResolvedSchoolDay = {
    date: "2026-09-07",
    dayName: "lundi",
    periodNumber: 1,
    weekNumber: 1,
    isHoliday: false,
    isVacation: false,
    slots: [
      {
        day: "Lundi",
        start: "08:45",
        end: "09:30",
        subject: "Français",
        hours: 1,
        slotType: "seance",
      } as JournalScheduleSlot,
    ],
  };

  const entries = dailyPlanner.planDay({
    journalId: "preview",
    resolvedDay,
    profile: { profile: { id: "p1", metadata: {} } } as never,
    seances: [
      {
        id: "s1",
        matiere: "Français",
        objectif: "Ne doit pas apparaître",
        competenceBo: "Compétence fictive",
      } as never,
    ],
    resourcesByMatiere: {},
    linkSeances: false,
  });

  assert.equal(entries[0].objectif, "");
  assert.equal(entries[0].competence, "");
}

function runJournalTests() {
  testBreakSlotsAreNonPedagogical();
  testEmptySlotHasNoPedagogicalContent();
  testBreakEntryIsSimple();
  testPlannerDoesNotInventSeanceContentWithoutLink();
  console.log("Journal tests: 4/4 passed");
}

runJournalTests();
