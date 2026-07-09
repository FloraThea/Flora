import * as XLSX from "xlsx";
import assert from "node:assert/strict";

import { parseTimetableFile } from "./parse-excel";
import { findDaysInCell, parseTimeCell } from "./normalize";

function workbookBuffer(rows: string[][], merges?: XLSX.Range[]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (merges?.length) sheet["!merges"] = merges;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "EDT");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
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

test("detects days with accents and casing", () => {
  assert.deepEqual(findDaysInCell("  LUNDI matin  ").map((d) => d.day), ["Lundi"]);
  assert.deepEqual(findDaysInCell("mercredi").map((d) => d.day), ["Mercredi"]);
});

test("parses multiple time formats", () => {
  assert.equal(parseTimeCell("8h30"), "08:30");
  assert.equal(parseTimeCell("08:30"), "08:30");
  assert.equal(parseTimeCell("13h45"), "13:45");
  assert.equal(parseTimeCell("08h30 - 09h30"), "08:30");
});

test("parses grid with days not on first row", () => {
  const buffer = workbookBuffer([
    ["", "Emploi du temps CM2", "", ""],
    ["", "Classe", "CM2", ""],
    ["", "", "", ""],
    ["", "Lundi", "Mardi", "Mercredi"],
    ["08:30", "Français", "Maths", "Questionner le monde"],
    ["09:30", "Maths", "Français", "EPS"],
  ]);

  const parsed = parseTimetableFile(buffer, "edt.xlsx");
  assert.equal(parsed.needsManualStructure, false);
  assert.ok(parsed.sessions.length >= 4);
  assert.equal(parsed.structure.headerRow, 3);
});

test("returns manual mode instead of throwing when days are missing", () => {
  const buffer = workbookBuffer([
    ["Titre", "Inconnu", "Format"],
    ["08:00", "A", "B"],
  ]);

  const parsed = parseTimetableFile(buffer, "edt.xlsx");
  assert.equal(parsed.needsManualStructure, true);
  assert.equal(parsed.sessions.length, 0);
  assert.ok(parsed.warnings.some((w) => w.includes("identifier automatiquement les jours")));
});

test("supports merged cells spanning multiple rows", () => {
  const buffer = workbookBuffer(
    [
      ["", "Lundi", "Mardi"],
      ["08:30", "Français CE2", "Maths"],
      ["", "", ""],
      ["09:30", "EPS", "Musique"],
    ],
    [{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }],
  );

  const parsed = parseTimetableFile(buffer, "edt-merge.xlsx");
  const french = parsed.sessions.find((s) => s.day === "Lundi" && s.startTime === "08:30");
  assert.ok(french);
  assert.equal(french?.subject, "Français");
});

test("accepts manual structure overrides", () => {
  const buffer = workbookBuffer([
    ["Titre de l'école", "", "", ""],
    ["", "", "", ""],
    ["", "Lundi", "Mardi", "Mercredi"],
    ["08:30", "Français", "Maths", "EPS"],
    ["10:00", "Musique", "Arts", "EMC"],
  ]);

  const manual = parseTimetableFile(buffer, "edt-weird.xlsx", undefined, {
    layout: "days_in_row",
    headerRow: 2,
    timeColumn: 0,
  });
  assert.equal(manual.needsManualStructure, false);
  assert.ok(manual.sessions.length >= 5);
  assert.ok(manual.days.includes("Mercredi"));
});

test("detects saturday and decorative title rows", () => {
  const buffer = workbookBuffer([
    ["", "École Flora — Année 2025-2026", "", "", ""],
    ["", "Lundi", "Mardi", "Mercredi", "Samedi"],
    ["8h30", "Français", "Maths", "EMC", "Sport"],
    ["9h30", "Maths", "Français", "Musique", "Théâtre"],
  ]);

  const parsed = parseTimetableFile(buffer, "edt-samedi.xlsx");
  assert.equal(parsed.needsManualStructure, false);
  assert.ok(parsed.days.includes("Samedi"));
  assert.ok(parsed.diagnostics.decorativeRows.includes(0));
});

test("parses csv export style", () => {
  const csv = [
    "Emploi du temps,,,",
    ",Lundi,Mardi,Mercredi",
    "08:30,Français,Maths,EPS",
    "09:30,Maths,Français,Questionner le monde",
  ].join("\n");
  const buffer = Buffer.from(csv, "utf8");
  const parsed = parseTimetableFile(buffer, "edt.csv");
  assert.equal(parsed.needsManualStructure, false);
  assert.ok(parsed.sessions.length >= 4);
});

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} tests passed`);
process.exit(failed > 0 ? 1 : 0);
