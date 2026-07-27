/**
 * Tests détection structure document + génération adaptative des séquences.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/pedagogical/document-structure/run-structure-detection-tests.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readExcelWorkbook } from "@/lib/import/read-excel-workbook";
import { adaptRowsToCalendar } from "@/lib/programming/import/adapt-programmation";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import { buildModuleSummariesFromRows } from "@/lib/programming/module-summaries";
import { detectDocumentStructure, shouldRestituteFromStructure } from "@/lib/pedagogical/document-structure/detect-structure";
import { resolveProgressionStructureSync } from "@/lib/pedagogical/document-structure/resolve-structure-sync";
import { MHM_MATH_STRUCTURE } from "@/lib/pedagogical/document-structure/types";
import { learningPathEngine } from "@/lib/progression/LearningPathEngine";
import { WeeklyPlanner } from "@/lib/progression/WeeklyPlanner";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import {
  buildSequenceDraftFromGroupedRows,
  findGroupedRowsForAnchorRow,
  groupProgressionRowsByStructure,
  shouldUseSequenceRestitution,
} from "@/lib/sequences/sequence-grouping";

const FIXTURES_DIR = path.join(process.cwd(), "tests/validation/progression");

function testMhmMathForcesModules() {
  const structure = detectDocumentStructure({
    methode: "MHM",
    matiere: "Mathématiques",
  });
  assert.equal(structure.kind, "modules");
  assert.equal(structure.sequenceGrouping, "module");
  assert.equal(structure.source, "method");
  console.log("✓ MHM Mathématiques → structure modules (forcée)");
}

function testMhmFrenchDoesNotForceModules() {
  const structure = detectDocumentStructure({
    methode: "MHM",
    matiere: "Français",
  });
  assert.notEqual(structure.kind, "modules");
  assert.equal(shouldUseSequenceRestitution({ methode: "MHM", matiere: "Français" }), false);
  console.log(`✓ MHM Français → structure ${structure.kind} (pas de modules imposés)`);
}

function testSequenceLabelsDetection() {
  const structure = detectDocumentStructure({
    rows: [
      { sequence: "Séquence 1", seance: "Séance 1" } as never,
      { sequence: "Séquence 1", seance: "Séance 2" } as never,
      { sequence: "Séquence 2", seance: "Séance 1" } as never,
    ],
  });
  assert.equal(structure.kind, "sequences");
  assert.equal(structure.sequenceGrouping, "sequence");
  console.log("✓ Labels « Séquence » → regroupement par séquences");
}

function testPeriodeOnlyDetection() {
  const structure = detectDocumentStructure({
    rows: [
      { periodNumber: 1, sequence: "", seance: "Séance A" } as never,
      { periodNumber: 1, sequence: "", seance: "Séance B" } as never,
      { periodNumber: 2, sequence: "", seance: "Séance C" } as never,
    ],
  });
  assert.equal(structure.kind, "periodes");
  assert.equal(structure.sequenceGrouping, "periode");
  console.log("✓ Périodes seules → regroupement par période");
}

function testLibreDefault() {
  const structure = detectDocumentStructure({
    methode: "Inventaire",
    matiere: "Sciences",
    rows: [{ sequence: "", seance: "Atelier 1" } as never],
  });
  assert.equal(structure.kind, "libre");
  assert.equal(structure.sequenceGrouping, "row");
  assert.equal(shouldRestituteFromStructure(structure), false);
  console.log("✓ Méthode inconnue → structure libre (1 ligne = 1 séquence)");
}

function testMhmProgressionGrouping() {
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

  const structure = resolveProgressionStructureSync({
    methode: "MHM",
    matiere: "Mathématiques",
    progressionMetadata: { structure_document: MHM_MATH_STRUCTURE },
  });

  const groups = groupProgressionRowsByStructure(progressionRows, structure);
  assert.equal(groups.size, 24, "24 modules MHM → 24 séquences");

  const module1Rows = findGroupedRowsForAnchorRow(progressionRows, progressionRows[0]!, structure);
  assert.equal(module1Rows.length, summaries[0]?.sessionCount ?? 0);

  const draft = buildSequenceDraftFromGroupedRows({
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
      progression: { id: "p1", metadata: { structure_document: MHM_MATH_STRUCTURE } } as never,
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
    structure,
  });

  assert.equal(draft.sessionCount, module1Rows.length);
  assert.match(draft.title, /Module 1/i);
  console.log(`✓ Progression MHM — ${groups.size} séquences, module 1 = ${draft.sessionCount} séances`);
}

function runStructureDetectionTests() {
  testMhmMathForcesModules();
  testMhmFrenchDoesNotForceModules();
  testSequenceLabelsDetection();
  testPeriodeOnlyDetection();
  testLibreDefault();
  testMhmProgressionGrouping();
  console.log("Structure detection tests: 6/6 passed");
}

runStructureDetectionTests();
