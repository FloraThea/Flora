import assert from "node:assert/strict";
import { isJournalEntryProtected, isDemoMetadata, journalSlotKey } from "./journal-entry-utils";
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

function testProtectedEntryDetection() {
  assert.equal(
    isJournalEntryProtected({
      id: "1",
      journalId: "j1",
      sortOrder: 1,
      entryType: "slot",
      startTime: "08:00",
      endTime: "09:00",
      matiere: "Français",
      seanceId: null,
      ritualId: null,
      ritualLabel: "",
      competence: "Lire",
      objectif: "",
      dureeMinutes: 60,
      organisation: "",
      materiel: { items: [], guides: [], albums: [], fiches: [], jeux: [], autres: [] },
      documents: [],
      resources: {
        guides: [],
        albums: [],
        fiches: [],
        documents: [],
        jeux: [],
        videos: [],
        numeriques: [],
        liens: [],
      },
      observations: "",
      slotData: {},
      metadata: { fillState: "manual" },
    }),
    true,
  );

  assert.equal(isDemoMetadata({ source: "seed" }), true);
  assert.equal(isDemoMetadata({}), false);
  assert.equal(
    journalSlotKey({
      startTime: "08:00",
      matiere: "Maths",
      slotData: { sourceScheduleSlotId: "slot-42" },
    }),
    "id:slot-42",
  );
}

function testRestitutionModeLinksImportedSeance() {
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
        objectif: "Objectif importé",
        competenceBo: "Compétence importée",
        pedagogicalChoices: ["Organisation importée"],
        title: "Séance 1",
        dureeMinutes: 45,
        materiel: {
          guides: [],
          albums: [],
          affichages: [],
          manipulation: [],
          videoprojecteur: [],
          photocopies: [],
          fiches: [],
          cartes: [],
          jeux: [],
          autres: [],
        },
        differentiation: {
          elevesFragiles: [],
          elevesAvances: [],
          groupesBesoins: [],
          adaptations: [],
          variantes: [],
        },
        resources: [],
        metadata: {},
      } as never,
    ],
    resourcesByMatiere: {},
    restitutionMode: true,
  });

  assert.equal(entries[0].objectif, "Objectif importé");
  assert.equal(entries[0].competence, "Compétence importée");
  assert.equal(entries[0].metadata.fillState, "linked");
}

function testRestitutionModeMarksMissingSeance() {
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
        subject: "Mathématiques",
        hours: 1,
        slotType: "seance",
      } as JournalScheduleSlot,
    ],
  };

  const entries = dailyPlanner.planDay({
    journalId: "preview",
    resolvedDay,
    profile: { profile: { id: "p1", metadata: {} } } as never,
    seances: [],
    resourcesByMatiere: {},
    restitutionMode: true,
  });

  assert.equal(entries[0].metadata.fillState, "missing");
  assert.match(entries[0].objectif ?? "", /non importée/i);
  assert.equal(entries[0].competence, "");
}

function testRestitutionModeUsesProfileRitual() {
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
        start: "08:30",
        end: "08:45",
        subject: "Calcul mental",
        hours: 0.25,
        slotType: "rituel",
      } as JournalScheduleSlot,
    ],
  };

  const entries = dailyPlanner.planDay({
    journalId: "preview",
    resolvedDay,
    profile: {
      profile: {
        id: "p1",
        metadata: {
          rituals: [
            {
              id: "rituel-calcul",
              label: "Calcul mental",
              matiere: "Mathématiques",
              objectif: "Automatiser les procédures.",
              organisation: "Rituel oral rapide.",
              dureeMinutes: 15,
            },
          ],
        },
      },
    } as never,
    seances: [],
    resourcesByMatiere: {},
    restitutionMode: true,
  });

  assert.equal(entries[0].entryType, "ritual");
  assert.equal(entries[0].objectif, "Automatiser les procédures.");
  assert.equal(entries[0].metadata.fillState, "linked");
}

function runJournalTests() {
  testBreakSlotsAreNonPedagogical();
  testEmptySlotHasNoPedagogicalContent();
  testBreakEntryIsSimple();
  testPlannerDoesNotInventSeanceContentWithoutLink();
  testRestitutionModeLinksImportedSeance();
  testRestitutionModeMarksMissingSeance();
  testRestitutionModeUsesProfileRitual();
  testProtectedEntryDetection();
  console.log("Journal tests: 8/8 passed");
}

runJournalTests();
