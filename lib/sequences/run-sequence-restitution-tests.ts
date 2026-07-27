/**
 * Tests restitution séquences/séances MHM.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/sequences/run-sequence-restitution-tests.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readExcelWorkbook } from "@/lib/import/read-excel-workbook";
import { adaptRowsToCalendar } from "@/lib/programming/import/adapt-programmation";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import { buildModuleSummariesFromRows } from "@/lib/programming/module-summaries";
import { learningPathEngine } from "@/lib/progression/LearningPathEngine";
import { WeeklyPlanner } from "@/lib/progression/WeeklyPlanner";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import {
  buildSequenceDraftFromModuleRows,
  findModuleRowsForAnchorRow,
  groupProgressionRowsByModule,
  shouldUseSequenceRestitution,
} from "@/lib/sequences/sequence-grouping";
import { buildSeanceDraftFromProgressionRow } from "@/lib/seances/seance-restitution";

const FIXTURES_DIR = path.join(process.cwd(), "tests/validation/progression");

function testMhmSequenceRestitutionFromProgressionRows() {
  const filePath = path.join(FIXTURES_DIR, "Programmation_MHM_CE1_CE2_v3.xlsx");
  const workbook = readExcelWorkbook(readFileSync(filePath), "Programmation_MHM_CE1_CE2_v3.xlsx");
  const { rows } = rowsFromGrid(workbook.grid, undefined, { sourceSheet: workbook.activeSheetName });
  const calendar = schoolWeeksCalculator.calculate("2026-2027", "A");
  const { tables } = adaptRowsToCalendar({
    rows,
    calendar,
    matiere: "Mathématiques",
    discipline: "Mathématiques",
  });

  const table = tables[0]!;
  const summaries = buildModuleSummariesFromRows(rows);
  const paths = learningPathEngine.buildPathsForTable(table, "MHM", {
    programmation: {
      programmation: { metadata: { moduleSummaries: summaries } } as never,
      tables,
      validation: { valid: true, issues: [], summary: {} as never },
    },
    referentiel: [],
    resources: [],
    calendar,
    timetable: { slots: [], weeklyHoursBySubject: { Mathématiques: 5 } },
    methode: "MHM",
  });

  const weeklyPlanner = new WeeklyPlanner();
  const progressionRows = weeklyPlanner
    .planTableRows(table, paths, {
      programmation: {
        programmation: {} as never,
        tables,
        validation: { valid: true, issues: [], summary: {} as never },
      },
      referentiel: [],
      resources: [],
      calendar,
      timetable: { slots: [], weeklyHoursBySubject: { Mathématiques: 5 } },
      methode: "MHM",
    })
    .map((row, index) => ({ ...row, id: `row-${index}`, sortOrder: index }));

  assert.ok(progressionRows.length > 24, "La progression MHM doit contenir une ligne par séance");

  const groups = groupProgressionRowsByModule(progressionRows);
  assert.equal(groups.size, 24, "24 modules doivent produire 24 séquences");

  const module1Rows = findModuleRowsForAnchorRow(progressionRows, progressionRows[0]!);
  assert.equal(module1Rows.length, summaries[0]?.sessionCount ?? 0);

  const draft = buildSequenceDraftFromModuleRows({
    rows: module1Rows,
    tab: {
      subjectKey: "maths",
      subjectLabel: "Mathématiques",
      subSubjectLabel: "Mathématiques",
      accent: "lavender",
      sortOrder: 0,
      rows: module1Rows,
    },
    context: {
      progression: { id: "p1", metadata: {} } as never,
      tab: {
        subjectKey: "maths",
        subjectLabel: "Mathématiques",
        subSubjectLabel: "Mathématiques",
        accent: "lavender",
        sortOrder: 0,
        rows: module1Rows,
      },
      row: module1Rows[0]!,
      referentiel: [],
      resources: [],
      methode: "MHM",
      cycle: "Cycle 2",
      niveau: "CE2",
      schoolYear: "2026-2027",
    },
  });

  assert.equal(draft.sessionCount, module1Rows.length);
  assert.equal(draft.sessions.length, module1Rows.length);
  assert.match(draft.title, /Module 1/i);
  assert.equal(draft.evaluations.length, 0, "Aucune évaluation inventée en mode restitution");

  const seanceDraft = buildSeanceDraftFromProgressionRow({
    row: module1Rows[0]!,
    sequenceSession: draft.sessions[0]!,
    matiere: "Mathématiques",
    sousMatiere: "Mathématiques",
    niveau: "CE2",
    cycle: "Cycle 2",
    methode: "MHM",
    periodNumber: module1Rows[0]!.periodNumber,
  });

  assert.equal(seanceDraft.pedagogicalChoices.length, 0);
  assert.ok(seanceDraft.objectif.length > 0);
  assert.ok(
    seanceDraft.phases.some((phase) => phase.summary.length > 0) || seanceDraft.objectif.length > 0,
  );
  console.log(
    `✓ Restitution MHM — ${groups.size} séquences, module 1 = ${draft.sessionCount} séances`,
  );
}

function testRestitutionModeDetection() {
  assert.equal(
    shouldUseSequenceRestitution({ methode: "MHM", matiere: "Mathématiques" }),
    true,
  );
  assert.equal(
    shouldUseSequenceRestitution({ methode: "MHM", matiere: "Français" }),
    false,
  );
  assert.equal(shouldUseSequenceRestitution({ methode: "Lecture" }), false);
  assert.equal(
    shouldUseSequenceRestitution({
      methode: "Lecture",
      progressionMetadata: {
        structure_document: {
          kind: "sequences",
          sequenceGrouping: "sequence",
          levels: ["sequence"],
          labels: {},
          signals: [],
          source: "detected",
        },
      },
    }),
    true,
  );
}

function runSequenceRestitutionTests() {
  testRestitutionModeDetection();
  testMhmSequenceRestitutionFromProgressionRows();
  console.log("Sequence restitution tests: 2/2 passed");
}

runSequenceRestitutionTests();
