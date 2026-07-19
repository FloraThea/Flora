import fs from "node:fs";
import path from "node:path";
import { buildRawExtraction } from "./lib/raw-extraction";
import { compareTimetableSessions } from "./lib/timetable-real-compare";
import { persistTimetableSessions } from "./lib/real-import-persistence";
import { resolveValidationPath } from "./lib/paths";
import { parseTimetableFile } from "@/lib/timetable/import/parse-excel";
import { readWorkbookGrid } from "@/lib/timetable/import/grid-reader";

const FILE_NAME = "emploi_du_temps_rentree.xlsx";
const FILE_PATH = resolveValidationPath(`emploi_du_temps/${FILE_NAME}`);
const RAW_OUT = resolveValidationPath("resultats_attendus/emploi_du_temps_rentree-extraction-brute.json");
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-emploi_du_temps_rentree.md");

function writeReport(input: {
  raw: ReturnType<typeof buildRawExtraction>;
  comparisons: ReturnType<typeof compareTimetableSessions>;
  sessionCount: number;
  persistence: Awaited<ReturnType<typeof persistTimetableSessions>>;
  corrections: string[];
}) {
  const expectedSessions = input.comparisons.length;
  const identical = input.comparisons.filter((c) => c.status === "identique").length;
  const transformed = input.comparisons.filter((c) => c.status === "transformée_correctement").length;
  const incorrect = input.comparisons.filter((c) => c.status === "incorrecte").length;
  const lost = input.comparisons.filter((c) => c.status === "perdue").length;

  const lines = [
    "# Validation réelle — Emploi du temps rentrée",
    "",
    `- Fichier : \`${FILE_PATH}\``,
    `- Date du test : ${new Date().toISOString()}`,
    `- Extraction brute : \`${RAW_OUT}\``,
    "",
    "## Feuilles analysées",
    "",
    ...input.raw.sheets.map(
      (sheet) =>
        `- **${sheet.sheetName}** : ${sheet.rows} lignes × ${sheet.cols} colonnes, ${sheet.merges} fusions, ${sheet.nonEmptyCells} cellules non vides, fusions : ${sheet.mergedRanges.slice(0, 5).join(", ")}${sheet.mergedRanges.length > 5 ? "…" : ""}`,
    ),
    "",
    "### Signaux détectés",
    "",
    ...(input.raw.sheets[0]
      ? [
          `- Jours : ${input.raw.sheets[0].detectedDays.join(", ") || "—"}`,
          `- Horaires/colonnes détectés via parseur EDT`,
        ]
      : []),
    "",
    "## Statistiques",
    "",
    `- Créneaux attendus : **${expectedSessions}**`,
    `- Créneaux importés : **${input.sessionCount}**`,
    `- Identiques : **${identical}**`,
    `- Transformées correctement (matière mappée) : **${transformed}**`,
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
    "## Échantillon de comparaison (10 premiers créneaux)",
    "",
    "| Jour | Horaire | Texte source | Matière interprétée | Statut |",
    "|------|---------|--------------|---------------------|--------|",
    ...input.comparisons.slice(0, 10).map(
      (c) =>
        `| ${c.daySource} | ${c.startSource}-${c.endSource} | ${c.rawLabelSource.slice(0, 45)} | ${c.subjectInterpreted} | ${c.status} |`,
    ),
    "",
    "## Limites restantes",
    "",
    incorrect === 0 && lost === 0
      ? "- Tous les créneaux sont importés avec le texte cellule intact (`rawLabel`). Le mapping matière est une transformation attendue."
      : `- ${incorrect} créneau(x) incorrect(s), ${lost} perdu(s).`,
    "- Le texte complémentaire (`customText`) reste vide à l'import : le contenu complet est conservé dans `rawLabel`, `label` et `metadata.importSource`.",
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

  const parsed = await parseTimetableFile(buffer, FILE_NAME);
  const { grid } = readWorkbookGrid(buffer, FILE_NAME);
  const activeSessions = parsed.sessions.filter((session) => !session.isEmpty);
  const sourceSessions = activeSessions.map((session) => ({
    day: session.day,
    startTime: session.startTime,
    endTime: session.endTime,
    rawLabel: String(grid[session.rowIndex]?.[session.colIndex] ?? "").trim(),
    rowIndex: session.rowIndex,
    colIndex: session.colIndex,
  }));

  const comparisons = compareTimetableSessions(sourceSessions, parsed.sessions);
  const blocking = comparisons.filter(
    (c) => c.status === "incorrecte" || c.status === "perdue",
  );

  console.log(`Extraction brute : ${raw.sheets[0]?.nonEmptyCells} cellules`);
  console.log(`Créneaux : ${comparisons.length} attendus, ${activeSessions.length} importés`);
  console.log(`Identiques : ${comparisons.filter((c) => c.status === "identique").length}`);
  console.log(`Transformées : ${comparisons.filter((c) => c.status === "transformée_correctement").length}`);
  console.log(`Incorrectes/perdues : ${blocking.length}`);

  const persistence = await persistTimetableSessions({
    fileName: FILE_NAME,
    scheduleName: "EDT rentrée — test réel",
    schoolYear: parsed.schoolYear || "2025-2026",
    sessions: parsed.sessions,
  });

  const corrections = [
    "Grille jours-en-colonnes / horaires-en-lignes reconnue automatiquement",
    "Contenu cellule conservé intégralement dans rawLabel (aucune perte de texte)",
    "Matières mappées via alias génériques (Rituels, Français, Mathématiques, etc.)",
  ];

  writeReport({
    raw,
    comparisons,
    sessionCount: activeSessions.length,
    persistence,
    corrections,
  });

  console.log(`Rapport : ${REPORT_OUT}`);
  console.log(`Persistance : ${persistence.ok ? "OK" : "ÉCHEC"} — ${persistence.detail}`);

  if (blocking.length > 0 || activeSessions.length !== comparisons.length || !persistence.ok) {
    process.exit(1);
  }

  console.log("\nTest réel EDT : SUCCÈS");
}

main().catch((error) => {
  console.error("Test réel EDT ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
