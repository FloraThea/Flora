import fs from "node:fs";
import path from "node:path";
import { buildRawExtraction } from "./lib/raw-extraction";
import { compareSpreadsheetRows } from "./lib/spreadsheet-real-compare";
import { persistProgressionRows } from "./lib/real-import-persistence";
import { readExcelGrid } from "./lib/read-excel-grid";
import { resolveValidationPath } from "./lib/paths";
import { extractSchoolYearFromText } from "@/lib/programming/import/spreadsheet-deterministic";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";

const FILE_NAME = "Progression_EMC_Editable_2026-2027.xlsx";
const FILE_PATH = resolveValidationPath(`progression/${FILE_NAME}`);
const RAW_OUT = resolveValidationPath(
  "resultats_attendus/Progression_EMC_Editable_2026-2027-extraction-brute.json",
);
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-Progression_EMC_Editable_2026-2027.md");

function writeReport(input: {
  raw: ReturnType<typeof buildRawExtraction>;
  comparisons: ReturnType<typeof compareSpreadsheetRows>;
  parsedRowCount: number;
  persistence: Awaited<ReturnType<typeof persistProgressionRows>>;
  corrections: string[];
}) {
  const expectedRows = input.comparisons.length;
  const identical = input.comparisons.filter((c) => c.status === "identique").length;
  const incorrect = input.comparisons.filter((c) => c.status === "incorrecte").length;
  const lost = input.comparisons.filter((c) => c.status === "perdue").length;

  const lines = [
    "# Validation réelle — Progression EMC",
    "",
    `- Fichier : \`${FILE_PATH}\``,
    `- Date du test : ${new Date().toISOString()}`,
    `- Extraction brute : \`${RAW_OUT}\``,
    "",
    "## Feuilles analysées",
    "",
    ...input.raw.sheets.map(
      (sheet) =>
        `- **${sheet.sheetName}** : ${sheet.rows} lignes × ${sheet.cols} colonnes, ${sheet.merges} fusions, ${sheet.nonEmptyCells} cellules non vides`,
    ),
    "",
    "### Signaux détectés (feuille active)",
    "",
    ...(input.raw.sheets[0]
      ? [
          `- Dates : ${input.raw.sheets[0].detectedDates.length} (${input.raw.sheets[0].detectedDates.slice(0, 5).join(", ")}${input.raw.sheets[0].detectedDates.length > 5 ? "…" : ""})`,
          `- Semaines : ${input.raw.sheets[0].detectedWeeks.join(", ")}`,
          `- Périodes : ${input.raw.sheets[0].detectedPeriods.join(", ")}`,
          `- Séances (échantillon) : ${input.raw.sheets[0].detectedSeances.slice(0, 5).join(" | ")}`,
        ]
      : []),
    "",
    "## Statistiques",
    "",
    `- Lignes pédagogiques attendues : **${expectedRows}**`,
    `- Lignes importées : **${input.parsedRowCount}**`,
    `- Dates interprétées : **${input.comparisons.filter((c) => c.dateInterpreted).length}/${expectedRows}**`,
    `- Périodes attendues/obtenues : **${[...new Set(input.comparisons.map((c) => c.periodExpected))].filter(Boolean).join(", ")}** / **${[...new Set(input.comparisons.map((c) => c.periodInterpreted))].filter(Boolean).join(", ")}**`,
    `- Identiques : **${identical}**`,
    `- Incorrectes : **${incorrect}**`,
    `- Perdues : **${lost}**`,
    "",
    "## Corrections appliquées",
    "",
    ...input.corrections.map((item) => `- ${item}`),
    "",
    "## Persistance Supabase",
    "",
    `- Changement d'onglet (liste) : ${input.persistence.afterTabSwitch ? "✓" : "✗"}`,
    `- Actualisation (reload) : ${input.persistence.afterRefresh ? "✓" : "✗"}`,
    `- Reconnexion : ${input.persistence.afterReconnect ? "✓" : "✗"}`,
    `- Vérification Supabase : ${input.persistence.supabaseVerified ? "✓" : "✗"}`,
    `- Résultat global : ${input.persistence.ok ? "✓ OK" : "✗ ÉCHEC"} — ${input.persistence.detail}`,
    "",
    "## Échantillon de comparaison (10 premières lignes)",
    "",
    "| Ligne | Semaine | Date source | Date interprétée | Période | Domaine | Séance | Statut |",
    "|------|---------|-------------|------------------|---------|---------|--------|--------|",
    ...input.comparisons.slice(0, 10).map(
      (c) =>
        `| ${c.sourceRowIndex} | ${c.weekSource} | ${c.dateSource} | ${c.dateInterpreted ?? "—"} | ${c.periodInterpreted ?? "—"} | ${c.domaineSource} | ${c.seanceSource.slice(0, 40)} | ${c.status} |`,
    ),
    "",
    "## Limites restantes",
    "",
    incorrect === 0 && lost === 0
      ? "- Aucune différence bloquante détectée sur les 34 lignes pédagogiques."
      : `- ${incorrect} ligne(s) incorrecte(s), ${lost} perdue(s) — voir extraction et comparaison détaillée.`,
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`Fichier manquant: ${FILE_PATH}`);
  }

  const buffer = fs.readFileSync(FILE_PATH);
  const raw = buildRawExtraction(buffer, FILE_NAME);
  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, `${JSON.stringify(raw, null, 2)}\n`);

  const wb = readExcelGrid(buffer, FILE_NAME);
  const schoolYear = extractSchoolYearFromText(
    wb.grid.slice(0, 6).map((row) => row.join(" ")).join("\n"),
  );
  const { rows } = rowsFromGrid(wb.grid, undefined, { sourceSheet: wb.sheetName });
  const comparisons = compareSpreadsheetRows(wb.grid, rows, schoolYear, "progression_emc");

  const incorrect = comparisons.filter((c) => c.status === "incorrecte" || c.status === "perdue");
  console.log(`Extraction brute : ${raw.sheets[0]?.nonEmptyCells} cellules`);
  console.log(`Lignes pédagogiques : ${comparisons.length} attendues, ${rows.length} importées`);
  console.log(`Identiques : ${comparisons.filter((c) => c.status === "identique").length}`);
  console.log(`Incorrectes/perdues : ${incorrect.length}`);

  const persistence = await persistProgressionRows({
    fileName: FILE_NAME,
    title: "Progression EMC — test réel",
    rows,
  });

  const corrections = [
    "Bandeaux PÉRIODE N sans sous-titre (ex. « PÉRIODE 1 » seul) reconnus via parsePeriodBanner générique",
    "Dates JJ/MM complétées via année scolaire extraite du document (2026-2027)",
    "Colonnes Domaine → domaine, Séance → seance, Semaine S1… → weekNumber",
    "Exclusion des lignes vacances / fériés / pied de page",
  ];

  writeReport({ raw, comparisons, parsedRowCount: rows.length, persistence, corrections });

  console.log(`Rapport : ${REPORT_OUT}`);
  console.log(`Persistance : ${persistence.ok ? "OK" : "ÉCHEC"} — ${persistence.detail}`);

  if (incorrect.length > 0 || rows.length !== comparisons.length || !persistence.ok) {
    process.exit(1);
  }

  console.log("\nTest réel EMC : SUCCÈS");
}

main().catch((error) => {
  console.error("Test réel EMC ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
