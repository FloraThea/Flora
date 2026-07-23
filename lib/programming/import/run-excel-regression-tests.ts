/**
 * Régression import Excel — progressions réelles enseignants.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/programming/import/run-excel-regression-tests.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readExcelWorkbook } from "@/lib/import/read-excel-workbook";
import { analyzeGridParse, rowsFromGrid } from "@/lib/programming/import/grid-parser";

const FIXTURES_DIR = path.join(process.cwd(), "tests/validation/progression");

function loadFixture(name: string): { fileName: string; grid: string[][]; sheetName: string } {
  const filePath = path.join(FIXTURES_DIR, name);
  const workbook = readExcelWorkbook(readFileSync(filePath), name);
  return { fileName: name, grid: workbook.grid, sheetName: workbook.activeSheetName };
}

function testAnglaisProgression() {
  const fixture = loadFixture("Progression_Anglais_Editable_2026-2027.xlsx");
  const diagnostics = analyzeGridParse(fixture.grid, { sourceSheet: fixture.sheetName });
  const { rows, headerIndex } = rowsFromGrid(fixture.grid, undefined, {
    sourceSheet: fixture.sheetName,
  });

  assert.equal(diagnostics.mode, "sections");
  assert.ok(diagnostics.confidence >= 0.6, `confidence=${diagnostics.confidence}`);
  assert.equal(rows.length, 35);
  assert.equal(headerIndex.week, 0);
  assert.equal(headerIndex.date, 1);
  assert.equal(rows[0]?.periodNumber, 1);
  assert.equal(rows[0]?.weekNumber, 1);
  assert.equal(rows[0]?.calendarDate, "2026-09-07");
  assert.equal(rows[0]?.discipline, "Anglais");
  assert.match(rows[0]?.objectif ?? "", /Se présenter/i);
  const period2Week1 = rows.find((row) => row.periodNumber === 2 && row.weekNumber === 1);
  assert.equal(period2Week1?.calendarDate, "2026-11-03");
  assert.match(period2Week1?.objectif ?? "", /jours de la semaine/i);
  assert.deepEqual(
    [...new Set(rows.map((row) => row.periodNumber))].sort(),
    [1, 2, 3, 4, 5],
  );

  console.log("✓ Progression Anglais — 35 semaines sur 5 périodes");
}

function testMhmProgrammation() {
  const fixture = loadFixture("Programmation_MHM_CE1_CE2_v3.xlsx");
  const diagnostics = analyzeGridParse(fixture.grid, { sourceSheet: fixture.sheetName });
  const { rows, headerIndex } = rowsFromGrid(fixture.grid, undefined, {
    sourceSheet: fixture.sheetName,
  });

  assert.equal(diagnostics.mode, "flat");
  assert.ok(diagnostics.confidence >= 0.5, `confidence=${diagnostics.confidence}`);
  assert.equal(rows.length, 24);
  assert.equal(headerIndex.period, 0);
  assert.equal(headerIndex.sequence, 1);
  assert.equal(headerIndex.seance, 2);
  assert.equal(rows[0]?.periodNumber, 1);
  assert.equal(rows[0]?.sequence, "M1");
  assert.match(rows[0]?.seance ?? "", /5 séances/i);
  assert.match(rows[0]?.objectif ?? "", /Connaissance des nombres/i);
  assert.equal(rows[0]?.discipline, "Mathématiques");
  assert.deepEqual(
    [...new Set(rows.map((row) => row.periodNumber))].sort(),
    [1, 2, 3, 4, 5],
  );

  console.log("✓ Programmation MHM — 24 modules sur 5 périodes");
}

function testEmcRegression() {
  const fixture = loadFixture("Progression_EMC_Editable_2026-2027.xlsx");
  const { rows } = rowsFromGrid(fixture.grid, undefined, { sourceSheet: fixture.sheetName });

  assert.equal(rows.length, 34);
  assert.equal(rows[0]?.periodNumber, 1);
  assert.equal(rows[0]?.weekNumber, 1);
  assert.equal(rows[0]?.calendarDate, "2026-09-07");
  assert.match(rows[0]?.seance ?? "", /Qui suis-je/i);

  console.log("✓ Progression EMC — format existant toujours compatible");
}

function run() {
  testAnglaisProgression();
  testMhmProgrammation();
  testEmcRegression();
  console.log("Excel regression tests: 3/3 passed");
}

run();
