/**
 * Validation critique : import Excel + diagnostic Cahier Journal.
 * Usage: npx tsx scripts/validate-critical-import-journal.ts
 */

import fs from "node:fs";
import path from "node:path";
import { readExcelWorkbook, logExcelReadDiagnostics, buildExcelReadDiagnostics } from "../lib/import/read-excel-workbook";
import { rowsFromGrid } from "../lib/programming/import/grid-parser";
import { dedupeJournalEntries, reconcileJournalEntriesWithTimetable } from "../lib/journal/journal-entry-reconcile";
import type { JournalEntry } from "../lib/journal/types";

const ROOT = process.cwd();

const EXCEL_FILES = [
  {
    label: "Programmation HDA",
    path: "tests/validation/programmation/Programmation_HDA_Editable_2026-2027.xlsx",
  },
  {
    label: "Progression EMC",
    path: "tests/validation/progression/Progression_EMC_Editable_2026-2027.xlsx",
  },
];

function validateExcel(filePath: string, label: string) {
  const absolute = path.join(ROOT, filePath);
  const buffer = fs.readFileSync(absolute);
  const workbook = readExcelWorkbook(buffer, path.basename(absolute));
  const diagnostics = buildExcelReadDiagnostics(workbook);
  logExcelReadDiagnostics(path.basename(absolute), diagnostics);

  const parsedGrid = rowsFromGrid(workbook.grid, undefined, { sourceSheet: workbook.activeSheetName });
  const cellCount = workbook.stats.nonEmptyCells;

  console.log(`\n=== ${label} ===`);
  console.log(`Fichier: ${filePath}`);
  console.log(`Feuilles: ${workbook.sheetNames.join(", ")}`);
  console.log(`Feuille active: ${workbook.activeSheetName}`);
  console.log(`Grille: ${workbook.grid.length} lignes × ${workbook.grid[0]?.length ?? 0} colonnes`);
  console.log(`Cellules non vides: ${cellCount}`);
  console.log(`Lignes structurées: ${parsedGrid.rows.length}`);

  if (cellCount > 0 && parsedGrid.rows.length === 0) {
    logExcelReadDiagnostics(path.basename(absolute), {
      ...diagnostics,
      rejectReason: "no_structured_rows",
    });
    throw new Error(`${label}: cellules détectées mais aucune ligne structurée — échec validation.`);
  }
  if (cellCount === 0) {
    throw new Error(`${label}: aucune cellule non vide — échec validation.`);
  }

  return parsedGrid.rows.length;
}

function validateJournalReconcile() {
  const daySlots = [
    {
      day: "Lundi",
      start: "08:30",
      end: "09:30",
      subject: "Français",
      hours: 1,
      slotType: "seance",
      sourceScheduleSlotId: "slot-real-1",
    },
    {
      day: "Lundi",
      start: "09:30",
      end: "10:30",
      subject: "Mathématiques",
      hours: 1,
      slotType: "seance",
      sourceScheduleSlotId: "slot-real-2",
    },
  ];

  const entries: JournalEntry[] = [
    {
      id: "1",
      journalId: "j1",
      sortOrder: 1,
      entryType: "session",
      startTime: "08:30",
      endTime: "09:30",
      matiere: "Français",
      seanceId: null,
      ritualId: null,
      ritualLabel: "",
      competence: "",
      objectif: "",
      dureeMinutes: 60,
      organisation: "",
      materiel: { items: [], guides: [], albums: [], fiches: [], jeux: [], autres: [] },
      documents: [],
      resources: { guides: [], albums: [], fiches: [], documents: [], jeux: [], videos: [], numeriques: [], liens: [] },
      observations: "",
      slotData: { sourceScheduleSlotId: "slot-real-1" },
      metadata: { source: "timetable" },
      observation: null,
    },
    {
      id: "2",
      journalId: "j1",
      sortOrder: 2,
      entryType: "session",
      startTime: "08:30",
      endTime: "09:30",
      matiere: "Français",
      seanceId: null,
      ritualId: null,
      ritualLabel: "",
      competence: "",
      objectif: "",
      dureeMinutes: 60,
      organisation: "",
      materiel: { items: [], guides: [], albums: [], fiches: [], jeux: [], autres: [] },
      documents: [],
      resources: { guides: [], albums: [], fiches: [], documents: [], jeux: [], videos: [], numeriques: [], liens: [] },
      observations: "",
      slotData: { sourceScheduleSlotId: "slot-fake-1" },
      metadata: { source: "demo" },
      observation: null,
    },
    {
      id: "3",
      journalId: "j1",
      sortOrder: 3,
      entryType: "session",
      startTime: "09:30",
      endTime: "10:30",
      matiere: "Mathématiques",
      seanceId: null,
      ritualId: null,
      ritualLabel: "",
      competence: "",
      objectif: "",
      dureeMinutes: 60,
      organisation: "",
      materiel: { items: [], guides: [], albums: [], fiches: [], jeux: [], autres: [] },
      documents: [],
      resources: { guides: [], albums: [], fiches: [], documents: [], jeux: [], videos: [], numeriques: [], liens: [] },
      observations: "",
      slotData: { sourceScheduleSlotId: "slot-real-2" },
      metadata: { source: "timetable" },
      observation: null,
    },
  ];

  const reconciled = reconcileJournalEntriesWithTimetable({ entries, daySlots });

  console.log("\n=== Cahier Journal — réconciliation ===");
  console.log(`Entrées initiales: ${entries.length}`);
  console.log(`Après réconciliation EDT réel: ${reconciled.length}`);

  if (reconciled.length !== 2) {
    throw new Error(`Réconciliation journal: attendu 2 créneaux, obtenu ${reconciled.length}`);
  }
}

function main() {
  console.log("Flora — validation critique import Excel + Cahier Journal");
  console.log("=".repeat(60));

  let totalRows = 0;
  for (const file of EXCEL_FILES) {
    totalRows += validateExcel(file.path, file.label);
  }

  validateJournalReconcile();

  console.log("\n" + "=".repeat(60));
  console.log(`SUCCÈS — ${EXCEL_FILES.length} fichiers Excel analysés, ${totalRows} lignes structurées au total.`);
  console.log("Logs d'import : voir lignes [excel-import] ci-dessus.");
  console.log("Cahier Journal : ouvrir /cahier-journal après connexion pour vérifier visuellement.");
}

main();
