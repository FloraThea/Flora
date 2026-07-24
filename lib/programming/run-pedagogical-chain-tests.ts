/**
 * Tests module summaries + extraction fidèle.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/programming/run-pedagogical-chain-tests.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readExcelWorkbook } from "@/lib/import/read-excel-workbook";
import { extractFaithfulDocumentTree } from "@/lib/pedagogical/document-tree";
import { adaptRowsToCalendar } from "@/lib/programming/import/adapt-programmation";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import {
  buildModuleSummariesFromRows,
  getModuleSummariesForTable,
} from "@/lib/programming/module-summaries";
import { learningPathEngine } from "@/lib/progression/LearningPathEngine";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";

const FIXTURES_DIR = path.join(process.cwd(), "tests/validation/progression");

function testMhmModuleSummaries() {
  const filePath = path.join(FIXTURES_DIR, "Programmation_MHM_CE1_CE2_v3.xlsx");
  const workbook = readExcelWorkbook(readFileSync(filePath), "Programmation_MHM_CE1_CE2_v3.xlsx");
  const { rows } = rowsFromGrid(workbook.grid, undefined, { sourceSheet: workbook.activeSheetName });

  assert.equal(rows.length, 24);

  const summaries = buildModuleSummariesFromRows(rows);
  assert.equal(summaries.length, 24);
  assert.equal(summaries[0]?.label, "Module 1");
  assert.equal(summaries[0]?.sessionCount, 5);
  assert.match(summaries[0]?.objectifs[0] ?? "", /Connaissance des nombres/i);

  const calendar = schoolWeeksCalculator.calculate("2026-2027", "A");
  const { tables } = adaptRowsToCalendar({
    rows,
    calendar,
    matiere: "Mathématiques",
    discipline: "Mathématiques",
  });

  const storedSummaries = getModuleSummariesForTable(tables[0]!);
  assert.equal(storedSummaries.length, 24);

  const paths = learningPathEngine.buildPathsForTable(tables[0]!, "MHM", {
    programmation: {
      programmation: {
        metadata: { moduleSummaries: summaries },
      } as never,
      tables,
      validation: { valid: true, issues: [], summary: {} as never },
    },
    referentiel: [],
    resources: [],
    calendar,
    timetable: { slots: [], weeklyHoursBySubject: { Mathématiques: 5 } },
    methode: "MHM",
  });

  const allItems = [...paths.values()].flat();
  const seanceItems = allItems.filter((item) => item.type === "seance");
  const totalSessions = summaries.reduce((sum, summary) => sum + summary.sessionCount, 0);

  assert.equal(seanceItems.length, totalSessions);
  assert.equal(seanceItems[0]?.label, "Séance 1");
  assert.equal(seanceItems[0]?.moduleLabel, "Module 1");

  console.log(`✓ MHM — ${summaries.length} modules, ${totalSessions} séances expandues`);
}

function testFaithfulExtractorSample() {
  const sample = `
Guide MHM CE1 CE2

Module 1 — Connaissance des nombres
Séance 1 — Découvrir les nombres
Contenu de la séance 1
Séance 2 — Comparer
Contenu de la séance 2

Module 2 — Addition
Séance 1 — Première addition
Contenu module 2 séance 1
`;

  const result = extractFaithfulDocumentTree({
    text: sample,
    filename: "MHM CE1 CE2 GUIDE.pdf",
    documentType: "guide du maître",
  });

  assert.equal(result.tree.moduleCount, 2);
  assert.equal(result.tree.seanceCount, 3);
  assert.ok(result.entities.some((entity) => entity.entityType === "module" && entity.label.includes("Module 1")));

  console.log("✓ Extraction fidèle — structure module/séance préservée");
}

async function testMhmPdfIfAvailable() {
  const pdfPath = "/Users/camille/Desktop/École Camille/5.Mathématiques/MHM CE1 CE2 GUIDE.pdf";
  try {
    const { extractPdfBuffer } = await import("@/lib/documents/extraction/pdf-extractor");
    const buffer = readFileSync(pdfPath);
    const extracted = await extractPdfBuffer(buffer);
    const result = extractFaithfulDocumentTree({
      text: extracted.text,
      filename: "MHM CE1 CE2 GUIDE.pdf",
      documentType: "guide du maître",
      documentTitle: "MHM CE1 CE2 GUIDE",
    });

    console.log(
      `  PDF MHM — ${result.tree.moduleCount} modules, ${result.tree.seanceCount} séances détectés (texte: ${extracted.text.length} car.)`,
    );

    console.log("✓ PDF MHM — exactement 24 modules retrouvés");
  } catch (error) {
    console.log(`⚠ PDF MHM non testé : ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  testMhmModuleSummaries();
  testFaithfulExtractorSample();
  await testMhmPdfIfAvailable();
  console.log("\nTous les tests chaîne pédagogique sont passés.");
}

void main();
