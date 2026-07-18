import assert from "node:assert/strict";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import {
  excelSerialToIsoDate,
  extractSchoolYearFromText,
  parseCalendarDateCell,
  parseFrenchDayOfWeek,
  parsePartialFrenchDate,
  parseSequenceSeanceCell,
} from "@/lib/programming/import/spreadsheet-deterministic";

function testExcelDate() {
  assert.equal(parseCalendarDateCell("15/09/2025"), "2025-09-15");
  assert.equal(parseCalendarDateCell("", 45200), excelSerialToIsoDate(45200));
}

function testFrenchDays() {
  assert.equal(parseFrenchDayOfWeek("lun."), "lundi");
  assert.equal(parseFrenchDayOfWeek("Mercredi"), "mercredi");
}

function testSequenceSeanceDisambiguation() {
  const seq = parseSequenceSeanceCell("Séquence 3", "sequence");
  assert.match(seq.sequence, /3/);
  assert.equal(seq.confidence, 0.95);

  const seance = parseSequenceSeanceCell("Séance n°2", "seance");
  assert.match(seance.seance, /2/);

  const week = parseSequenceSeanceCell("Semaine 5", "week");
  assert.equal(week.weekNumber, 5);
}

function testGridWithDatesAndInheritance() {
  const grid = [
    ["Date", "Jour", "Semaine", "Séquence", "Séance", "Objectif"],
    ["15/09/2025", "lundi", "1", "Séq. 1", "Séance 1", "Intro"],
    ["", "", "", "", "Séance 2", "Suite"],
  ];
  const { rows } = rowsFromGrid(grid, undefined, { sourceSheet: "Feuille1" });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.calendarDate, "2025-09-15");
  assert.equal(rows[0]?.dayOfWeek, "lundi");
  assert.equal(rows[0]?.weekNumber, 1);
  assert.match(rows[0]?.sequence ?? "", /1/);
  assert.equal(rows[1]?.seance, "Séance 2");
  assert.equal(rows[1]?.weekNumber, 1);
}

function testPartialDateWithSchoolYear() {
  assert.equal(parsePartialFrenchDate("07/09", "2026-2027"), "2026-09-07");
  assert.equal(parsePartialFrenchDate("04/01", "2026-2027"), "2027-01-04");
  assert.equal(extractSchoolYearFromText("Zone A 2026-2027"), "2026-2027");
}

function run() {
  testExcelDate();
  testFrenchDays();
  testSequenceSeanceDisambiguation();
  testGridWithDatesAndInheritance();
  testPartialDateWithSchoolYear();
  console.log("Spreadsheet deterministic tests: 5/5 passed");
}

run();
