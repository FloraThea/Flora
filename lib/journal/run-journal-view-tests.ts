import assert from "node:assert/strict";
import { applyJournalViewRules } from "./journal-view-rules";
import type { JournalEntry, JournalPayload } from "./types";

function basePayload(overrides: Partial<JournalPayload> = {}): JournalPayload {
  return {
    journal: {
      id: "j1",
      teacherProfileId: "p1",
      schoolYear: "2025-2026",
      journalDate: "2026-09-07",
      className: "CM2",
      effectif: 24,
      presents: 24,
      absents: [],
      dailyProject: "",
      mainObjectives: [],
      importantInfo: "",
      remarks: "",
      periodNumber: 1,
      weekNumber: 1,
      status: "draft",
      dashboard: {
        plannedMinutes: 0,
        actualMinutes: 0,
        completedSessions: 0,
        remainingSessions: 0,
        completedRituals: 0,
        workedCompetences: [],
        remainingCompetences: [],
        periodProgressPercent: 0,
        annualProgressPercent: 0,
      },
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    entries: [],
    adjustments: [],
    calendar: null,
    ...overrides,
  };
}

function sampleEntry(id: string): JournalEntry {
  return {
    id,
    journalId: "j1",
    sortOrder: 1,
    entryType: "slot",
    startTime: "08:45",
    endTime: "09:30",
    matiere: "Mathématiques",
    seanceId: null,
    ritualId: null,
    ritualLabel: "",
    competence: "",
    objectif: "",
    dureeMinutes: 45,
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
    slotData: { subSubject: "Nombres" },
    metadata: { fillState: "empty" },
  };
}

function testNoTimetableHidesEntries() {
  const enriched = applyJournalViewRules(
    basePayload({ entries: [sampleEntry("e1")] }),
    { hasTimetable: false },
  );
  assert.equal(enriched.hasTimetable, false);
  assert.equal(enriched.entries.length, 0);
}

function testManualDayKeepsEmptyShell() {
  const enriched = applyJournalViewRules(
    basePayload({
      journal: { ...basePayload().journal, metadata: { manualDay: true } },
      entries: [],
    }),
    { hasTimetable: false },
  );
  assert.equal(enriched.journal.metadata.manualDay, true);
  assert.equal(enriched.entries.length, 0);
}

function testDemoEntriesFiltered() {
  const enriched = applyJournalViewRules(
    basePayload({
      entries: [sampleEntry("e1"), { ...sampleEntry("e2"), metadata: { source: "demo" } }],
    }),
    { hasTimetable: true },
  );
  assert.equal(enriched.entries.length, 1);
  assert.equal(enriched.entries[0]?.id, "e1");
}

function testTimetableShowsEntriesWithoutInventedContent() {
  const entry = sampleEntry("e1");
  assert.equal(entry.objectif, "");
  assert.equal(entry.competence, "");
  const enriched = applyJournalViewRules(basePayload({ entries: [entry] }), {
    hasTimetable: true,
  });
  assert.equal(enriched.entries[0]?.objectif, "");
}

function runJournalViewTests() {
  testNoTimetableHidesEntries();
  testManualDayKeepsEmptyShell();
  testDemoEntriesFiltered();
  testTimetableShowsEntriesWithoutInventedContent();
  console.log("Journal view tests: 4/4 passed");
}

runJournalViewTests();
