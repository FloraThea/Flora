import fs from "node:fs";
import path from "node:path";
import { buildRawExtraction } from "./lib/raw-extraction";
import { compareTimetableSessions } from "./lib/timetable-real-compare";
import { persistTimetableSessions } from "./lib/real-import-persistence";
import { resolveValidationPath } from "./lib/paths";
import { parseTimetableFile } from "@/lib/timetable/import/parse-excel";
import { readWorkbookGrid } from "@/lib/timetable/import/grid-reader";
import { buildSourceSessionsFromGrid } from "@/lib/timetable/import/session-extractor";

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
  const expectedSessions = input.comparisons.filter((c) => c.status !== "creneau_duplique").length;
  const identical = input.comparisons.filter((c) => c.status === "identique").length;
  const scheduleWrong = input.comparisons.filter((c) => c.status === "horaire_incorrect").length;
  const textChanged = input.comparisons.filter((c) => c.status === "texte_modifie").length;
  const subjectReplaced = input.comparisons.filter((c) => c.status === "matiere_remplacee").length;
  const lost = input.comparisons.filter((c) => c.status === "creneau_perdu").length;
  const duplicated = input.comparisons.filter((c) => c.status === "creneau_duplique").length;
  const incorrect = scheduleWrong + textChanged + subjectReplaced + lost + duplicated;

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
    `- Horaires identiques : **${identical}**`,
    `- Textes source conservés : **${identical}**`,
    `- Créneaux incorrects : **${incorrect}**`,
    `- Créneaux perdus : **${lost}**`,
    `- Créneaux dupliqués : **${duplicated}**`,
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
    "## Comparaison complète (56 créneaux)",
    "",
    "| Jour | Cellule source | Début source | Fin source | Texte source | Début importé | Fin importée | Texte importé | Statut |",
    "|------|----------------|--------------|------------|--------------|---------------|--------------|---------------|--------|",
    ...input.comparisons
      .filter((c) => c.status !== "creneau_duplique")
      .map(
        (c) =>
          `| ${c.daySource} | ${c.celluleSource} | ${c.startSource} | ${c.endSource} | ${c.rawLabelSource.slice(0, 40)} | ${c.startInterpreted} | ${c.endInterpreted} | ${c.rawLabelInterpreted.slice(0, 40)} | ${c.status} |`,
      ),
    "",
    "## Preuve Lundi / Mardi 10:15",
    "",
    ...(() => {
      const lundi = input.comparisons.find(
        (c) => c.daySource === "Lundi" && c.startSource === "10:15" && c.endSource === "11:00",
      );
      const mardi = input.comparisons.find(
        (c) => c.daySource === "Mardi" && c.startSource === "10:15" && c.endSource === "10:30",
      );
      return [
        lundi
          ? `- Lundi 10:15–11:00 : ${lundi.status} — « ${lundi.rawLabelInterpreted} »`
          : "- Lundi 10:15–11:00 : absent",
        mardi
          ? `- Mardi 10:15–10:30 : ${mardi.status} — « ${mardi.rawLabelInterpreted} »`
          : "- Mardi 10:15–10:30 : absent",
      ];
    })(),
    "",
    "## Limites restantes",
    "",
    incorrect === 0
      ? "- Tous les créneaux sont importés avec horaires et textes source identiques au fichier Excel."
      : `- ${incorrect} écart(s) détecté(s) — voir tableau ci-dessus.`,
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
  const { grid, merges } = readWorkbookGrid(buffer, FILE_NAME);
  const sourceSessions = buildSourceSessionsFromGrid(grid, merges, parsed.structure);
  const activeSessions = parsed.sessions.filter((session) => !session.isEmpty);

  const comparisons = compareTimetableSessions(sourceSessions, parsed.sessions);
  const blocking = comparisons.filter((c) => c.status !== "identique");

  console.log(`Extraction brute : ${raw.sheets[0]?.nonEmptyCells} cellules`);
  console.log(`Créneaux : ${sourceSessions.length} attendus, ${activeSessions.length} importés`);
  console.log(`Identiques : ${comparisons.filter((c) => c.status === "identique").length}`);
  console.log(`Incorrects/perdus/dupliqués : ${blocking.length}`);

  const lundi = activeSessions.find((s) => s.day === "Lundi" && s.startTime === "10:15");
  const mardi = activeSessions.find((s) => s.day === "Mardi" && s.startTime === "10:15");
  console.log(`Lundi 10:15 → ${lundi?.endTime} | ${lundi?.rawLabel}`);
  console.log(`Mardi 10:15 → ${mardi?.endTime} | ${mardi?.rawLabel}`);

  const persistence = await persistTimetableSessions({
    fileName: FILE_NAME,
    scheduleName: "EDT rentrée — test réel",
    schoolYear: parsed.schoolYear || "2025-2026",
    sessions: parsed.sessions,
  });

  const corrections = [
    "Fin de créneau calculée depuis la dernière ligne fusionnée de chaque colonne/jour",
    "Contenu cellule conservé intégralement dans rawLabel et subject (texte visible)",
    "Matière Flora normalisée stockée dans normalizedSubject (couleurs/filtres uniquement)",
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

  if (blocking.length > 0 || activeSessions.length !== sourceSessions.length || !persistence.ok) {
    process.exit(1);
  }

  console.log("\nTest réel EDT : SUCCÈS");
}

main().catch((error) => {
  console.error("Test réel EDT ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
