import assert from "node:assert/strict";
import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import type { ProgrammationPayload } from "@/lib/programming/types";
import { mapImportedRowsToTabs } from "./import/map-import-to-tabs";

function makeRow(overrides: Partial<ImportedProgrammationRow>): ImportedProgrammationRow {
  return {
    id: overrides.id ?? "row-1",
    periodNumber: overrides.periodNumber ?? 1,
    weekNumber: overrides.weekNumber ?? 1,
    weekLabel: overrides.weekLabel ?? "S1",
    calendarDate: overrides.calendarDate ?? null,
    dayOfWeek: overrides.dayOfWeek ?? null,
    discipline: overrides.discipline ?? "",
    niveau: overrides.niveau ?? "",
    sequence: overrides.sequence ?? "Seq A",
    seance: overrides.seance ?? "Séance 1",
    objectif: overrides.objectif ?? "Objectif test",
    competences: overrides.competences ?? ["Compétence A"],
    notions: overrides.notions ?? [],
    materiel: overrides.materiel ?? ["Cahier"],
    ressources: overrides.ressources ?? [],
    remarques: overrides.remarques ?? "",
    deroulement: overrides.deroulement ?? "Déroulement test",
    evaluation: overrides.evaluation ?? "",
    differenciation: overrides.differenciation ?? "",
    domaine: overrides.domaine ?? "",
    rawLine: overrides.rawLine ?? "",
  };
}

function makeProgrammation(tables: ProgrammationPayload["tables"]): ProgrammationPayload {
  return {
    programmation: {
      id: "prog-1",
      title: "Programmation test",
      matiere: "Mathématiques",
      status: "validated",
    },
    tables,
    validation: { valid: true, issues: [], summary: {} },
  } as unknown as ProgrammationPayload;
}

function testSingleTableMapping() {
  const rows = [
    makeRow({ id: "r1", weekNumber: 1, seance: "Séance 1" }),
    makeRow({ id: "r2", weekNumber: 1, seance: "Séance 2" }),
    makeRow({ id: "r3", weekNumber: 2, seance: "Séance 3" }),
  ];

  const programmation = makeProgrammation([
    {
      id: "table-1",
      subjectKey: "maths",
      subjectLabel: "Mathématiques",
      subSubjectLabel: "",
      accent: "lavender",
      sortOrder: 0,
      periods: [],
    },
  ]);

  const tabs = mapImportedRowsToTabs(rows, programmation);

  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].rows.length, 3);
  assert.equal(tabs[0].rows[0].sessionNumber, 1);
  assert.equal(tabs[0].rows[1].sessionNumber, 2);
  assert.equal(tabs[0].rows[2].sessionNumber, 1);
  assert.equal(tabs[0].rows[0].competenceBo, "Compétence A");
}

function testDisciplineGrouping() {
  const rows = [
    makeRow({ id: "r1", discipline: "Français", seance: "Lecture" }),
    makeRow({ id: "r2", discipline: "Mathématiques", seance: "Numération" }),
  ];

  const programmation = makeProgrammation([
    {
      id: "table-fr",
      subjectKey: "francais",
      subjectLabel: "Français",
      subSubjectLabel: "",
      accent: "rose",
      sortOrder: 0,
      periods: [],
    },
    {
      id: "table-maths",
      subjectKey: "maths",
      subjectLabel: "Mathématiques",
      subSubjectLabel: "",
      accent: "lavender",
      sortOrder: 1,
      periods: [],
    },
  ]);

  const tabs = mapImportedRowsToTabs(rows, programmation);

  assert.equal(tabs.length, 2);
  assert.equal(tabs.find((tab) => tab.subjectKey === "francais")?.rows.length, 1);
  assert.equal(tabs.find((tab) => tab.subjectKey === "maths")?.rows.length, 1);
}

function runProgressionImportTests() {
  testSingleTableMapping();
  testDisciplineGrouping();
  console.log("Progression import tests: 2/2 passed");
}

runProgressionImportTests();
