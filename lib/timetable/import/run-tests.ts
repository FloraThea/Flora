import * as XLSX from "xlsx";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
let pending = 0;
let finished = false;

function maybeFinish() {
  pending -= 1;
  if (pending <= 0 && !finished) {
    finished = true;
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} tests passed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

function queueTest(name: string, fn: () => void | Promise<void>) {
  pending += 1;
  Promise.resolve()
    .then(fn)
    .then(() => {
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
      maybeFinish();
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name, ok: false, error: message });
      console.error(`✗ ${name}: ${message}`);
      maybeFinish();
    });
}

queueTest("detects days with accents and casing", () => {
  assert.deepEqual(findDaysInCell("  LUNDI matin  ").map((d) => d.day), ["Lundi"]);
  assert.deepEqual(findDaysInCell("mercredi").map((d) => d.day), ["Mercredi"]);
});

queueTest("parses multiple time formats", () => {
  assert.equal(parseTimeCell("8h30"), "08:30");
  assert.equal(parseTimeCell("08:30"), "08:30");
  assert.equal(parseTimeCell("13h45"), "13:45");
  assert.equal(parseTimeCell("08h30 - 09h30"), "08:30");
});

queueTest("parses grid with days not on first row", async () => {
  const buffer = workbookBuffer([
    ["", "Emploi du temps CM2", "", ""],
    ["", "Classe", "CM2", ""],
    ["", "", "", ""],
    ["", "Lundi", "Mardi", "Mercredi"],
    ["08:30", "Français", "Maths", "Questionner le monde"],
    ["09:30", "Maths", "Français", "EPS"],
  ]);

  const parsed = await parseTimetableFile(buffer, "edt.xlsx");
  assert.equal(parsed.needsManualStructure, false);
  assert.ok(parsed.sessions.length >= 4);
  assert.equal(parsed.structure.headerRow, 3);
});

queueTest("returns manual mode instead of throwing when days are missing", async () => {
  const buffer = workbookBuffer([
    ["Titre", "Inconnu", "Format"],
    ["08:00", "A", "B"],
  ]);

  const parsed = await parseTimetableFile(buffer, "edt.xlsx");
  assert.equal(parsed.needsManualStructure, true);
  assert.equal(parsed.sessions.length, 0);
  assert.ok(parsed.warnings.some((w) => w.includes("identifier automatiquement les jours")));
});

queueTest("supports merged cells spanning multiple rows", async () => {
  const buffer = workbookBuffer(
    [
      ["", "Lundi", "Mardi"],
      ["08:30", "Français CE2", "Maths"],
      ["", "", ""],
      ["09:30", "EPS", "Musique"],
    ],
    [{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }],
  );

  const parsed = await parseTimetableFile(buffer, "edt-merge.xlsx");
  const french = parsed.sessions.find((s) => s.day === "Lundi" && s.startTime === "08:30");
  assert.ok(french);
  assert.equal(french?.endTime, "09:30");
  assert.equal(french?.rawLabel, "Français CE2");
  assert.equal(french?.subject, "Français CE2");
  assert.equal(french?.normalizedSubject, "Français");
});

queueTest("preserves independent end times for same start row across days (rentree file)", async () => {
  const filePath = path.resolve(
    process.cwd(),
    "tests/validation/emploi_du_temps/emploi_du_temps_rentree.xlsx",
  );
  assert.ok(fs.existsSync(filePath), `Fichier manquant: ${filePath}`);

  const buffer = fs.readFileSync(filePath);
  const parsed = await parseTimetableFile(buffer, "emploi_du_temps_rentree.xlsx");
  const lundi = parsed.sessions.find(
    (session) => session.day === "Lundi" && session.startTime === "10:15" && !session.isEmpty,
  );
  const mardi = parsed.sessions.find(
    (session) => session.day === "Mardi" && session.startTime === "10:15" && !session.isEmpty,
  );

  assert.ok(lundi);
  assert.ok(mardi);
  assert.equal(lundi.startTime, "10:15");
  assert.equal(lundi.endTime, "11:00");
  assert.equal(mardi.startTime, "10:15");
  assert.equal(mardi.endTime, "10:30");
  assert.notEqual(lundi.endTime, mardi.endTime);
  assert.equal(lundi.rawLabel, "Conjugaison (Réussir en grammaire)");
  assert.equal(mardi.rawLabel, "Correction dictée");
  assert.equal(lundi.subject, "Conjugaison (Réussir en grammaire)");
  assert.equal(mardi.subject, "Correction dictée");
  assert.equal(lundi.normalizedSubject, "Français");
});

queueTest("accepts manual structure overrides", async () => {
  const buffer = workbookBuffer([
    ["Titre de l'école", "", "", ""],
    ["", "", "", ""],
    ["", "Lundi", "Mardi", "Mercredi"],
    ["08:30", "Français", "Maths", "EPS"],
    ["10:00", "Musique", "Arts", "EMC"],
  ]);

  const manual = await parseTimetableFile(buffer, "edt-weird.xlsx", undefined, {
    layout: "days_in_row",
    headerRow: 2,
    timeColumn: 0,
  });
  assert.equal(manual.needsManualStructure, false);
  assert.ok(manual.sessions.length >= 5);
  assert.ok(manual.days.includes("Mercredi"));
});

queueTest("detects saturday and decorative title rows", async () => {
  const buffer = workbookBuffer([
    ["", "École Flora — Année 2025-2026", "", "", ""],
    ["", "Lundi", "Mardi", "Mercredi", "Samedi"],
    ["8h30", "Français", "Maths", "EMC", "Sport"],
    ["9h30", "Maths", "Français", "Musique", "Théâtre"],
  ]);

  const parsed = await parseTimetableFile(buffer, "edt-samedi.xlsx");
  assert.equal(parsed.needsManualStructure, false);
  assert.ok(parsed.days.includes("Samedi"));
  assert.ok(parsed.diagnostics.decorativeRows.includes(0));
});

queueTest("parses csv export style", async () => {
  const csv = [
    "Emploi du temps,,,",
    ",Lundi,Mardi,Mercredi",
    "08:30,Français,Maths,EPS",
    "09:30,Maths,Français,Questionner le monde",
  ].join("\n");
  const buffer = Buffer.from(csv, "utf8");
  const parsed = await parseTimetableFile(buffer, "edt.csv");
  assert.equal(parsed.needsManualStructure, false);
  assert.ok(parsed.sessions.length >= 4);
});
