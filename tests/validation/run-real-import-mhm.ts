/**
 * Test réel — Guide MHM CE1 CE2 (document utilisateur officiel)
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs tests/validation/run-real-import-mhm.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPdfRawExtraction } from "./lib/pdf-raw-extraction";
import { extractGuideSnapshot } from "./lib/extract-guide";
import { persistGuideDocument } from "./lib/real-import-persistence";
import { resolveValidationPath } from "./lib/paths";

const FILE_NAME = "MHM_CE1_CE2_GUIDE.pdf";
const FILE_PATH = resolveValidationPath(`guides_maitre/${FILE_NAME}`);
const RAW_OUT = resolveValidationPath("resultats_attendus/MHM_CE1_CE2_GUIDE-extraction-brute.json");
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-MHM_CE1_CE2_GUIDE.md");

type GuideComparison = {
  field: string;
  sourceValue: string | number | null;
  interpretedValue: string | number | null;
  storedValue: string | number | null;
  reloadedValue: string | number | null;
  status: "identique" | "transformée_correctement" | "incorrecte" | "perdue";
  notes: string[];
};

function writeReport(input: {
  raw: Awaited<ReturnType<typeof buildPdfRawExtraction>>;
  snapshot: Awaited<ReturnType<typeof extractGuideSnapshot>>;
  comparisons: GuideComparison[];
  persistence: Awaited<ReturnType<typeof persistGuideDocument>>;
  corrections: string[];
}) {
  const nonEmptyPages = input.raw.pages.filter((page) => page.textLength > 0).length;
  const identical = input.comparisons.filter((c) => c.status === "identique").length;

  const lines = [
    "# Validation réelle — Guide MHM CE1 CE2",
    "",
    `- Fichier : \`${FILE_PATH}\``,
    `- Date du test : ${new Date().toISOString()}`,
    `- Extraction brute : \`${RAW_OUT}\``,
    "",
    "## Document analysé",
    "",
    `- **${FILE_NAME}** : ${input.raw.pageCount} pages PDF, ${input.raw.totalTextLength} caractères extraits, ${nonEmptyPages} pages non vides`,
    "",
    "### Signaux détectés (ensemble du document)",
    "",
    `- Type document : **${input.snapshot.documentType}**`,
    `- Méthode : **${input.snapshot.methodDetected || "—"}**`,
    `- Mots-clés pédagogiques : ${input.snapshot.keywordsFound.join(", ")}`,
    `- Compétences (occurrences) : ${input.snapshot.stats.competenceMatches}`,
    `- Objectifs (occurrences) : ${input.snapshot.stats.objectifMatches}`,
    `- Matériel (occurrences) : ${input.snapshot.stats.materielMatches}`,
    `- Séances repérées dans le texte : pages avec contenu séance — ${input.raw.pages.filter((p) => p.detectedSeances.length > 0).length}`,
    "",
    "## Statistiques",
    "",
    `- Pages attendues : **50**`,
    `- Pages extraites : **${input.raw.pageCount}**`,
    `- Texte extrait : **${input.raw.totalTextLength}** caractères`,
    `- Champs comparés identiques : **${identical}/${input.comparisons.length}**`,
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
    "## Comparaison source / interprété / Supabase",
    "",
    "| Champ | Source | Interprété | Enregistré | Relu | Statut |",
    "|-------|--------|------------|------------|------|--------|",
    ...input.comparisons.map(
      (c) =>
        `| ${c.field} | ${String(c.sourceValue ?? "—")} | ${String(c.interpretedValue ?? "—")} | ${String(c.storedValue ?? "—")} | ${String(c.reloadedValue ?? "—")} | ${c.status} |`,
    ),
    "",
    "## Aperçu prévisualisation (800 premiers caractères)",
    "",
    "```",
    input.snapshot.preview.slice(0, 800),
    "```",
    "",
    "## Limites restantes",
    "",
    "- L'analyse IA complète (Gemini/Théa) n'est pas exécutée dans ce test batch — seuls l'extraction PDF, la classification et les métadonnées déterministes sont validés.",
    "- Le type « programmation » provient du classificateur (mot-clé dans les 6000 premiers caractères) ; le document reste identifiable comme guide MHM via `methode` et mots-clés.",
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  assert.ok(fs.existsSync(FILE_PATH), `Fichier manquant: ${FILE_PATH}`);

  const buffer = fs.readFileSync(FILE_PATH);
  const raw = await buildPdfRawExtraction(buffer, FILE_NAME);
  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, `${JSON.stringify(raw, null, 2)}\n`);

  const snapshot = await extractGuideSnapshot(buffer, FILE_NAME);

  const persistence = await persistGuideDocument({
    fileName: FILE_NAME,
    fileSize: buffer.length,
    snapshot,
    previewText: snapshot.preview,
  });

  const comparisons: GuideComparison[] = [
    {
      field: "pageCount",
      sourceValue: 50,
      interpretedValue: snapshot.stats.pageCount,
      storedValue: persistence.stored.pageCount,
      reloadedValue: persistence.reloaded.pageCount,
      status:
        snapshot.stats.pageCount === 50 && persistence.reloaded.pageCount === 50
          ? "identique"
          : "incorrecte",
      notes: [],
    },
    {
      field: "textLength",
      sourceValue: raw.totalTextLength,
      interpretedValue: snapshot.stats.textLength,
      storedValue: persistence.stored.textLength,
      reloadedValue: persistence.reloaded.textLength,
      status:
        snapshot.stats.textLength === raw.totalTextLength &&
        persistence.reloaded.textLength === raw.totalTextLength
          ? "identique"
          : "incorrecte",
      notes: [],
    },
    {
      field: "methode",
      sourceValue: "MHM",
      interpretedValue: snapshot.methodDetected,
      storedValue: persistence.stored.methode,
      reloadedValue: persistence.reloaded.methode,
      status: persistence.reloaded.methode === "MHM" ? "identique" : "incorrecte",
      notes: [],
    },
    {
      field: "documentType",
      sourceValue: snapshot.documentType,
      interpretedValue: snapshot.documentType,
      storedValue: persistence.stored.documentType,
      reloadedValue: persistence.reloaded.documentType,
      status:
        persistence.reloaded.documentType === snapshot.documentType ? "identique" : "incorrecte",
      notes: [],
    },
    {
      field: "competenceMatches",
      sourceValue: snapshot.stats.competenceMatches,
      interpretedValue: snapshot.stats.competenceMatches,
      storedValue: persistence.stored.competenceMatches,
      reloadedValue: persistence.reloaded.competenceMatches,
      status:
        persistence.reloaded.competenceMatches === snapshot.stats.competenceMatches
          ? "identique"
          : "incorrecte",
      notes: [],
    },
    {
      field: "objectifMatches",
      sourceValue: snapshot.stats.objectifMatches,
      interpretedValue: snapshot.stats.objectifMatches,
      storedValue: persistence.stored.objectifMatches,
      reloadedValue: persistence.reloaded.objectifMatches,
      status:
        persistence.reloaded.objectifMatches === snapshot.stats.objectifMatches
          ? "identique"
          : "incorrecte",
      notes: [],
    },
  ];

  const blocking = comparisons.filter(
    (c) => c.status === "incorrecte" || c.status === "perdue",
  );

  console.log(`Extraction brute : ${raw.pageCount} pages, ${raw.totalTextLength} caractères`);
  console.log(`Méthode détectée : ${snapshot.methodDetected}`);
  console.log(`Champs identiques : ${comparisons.filter((c) => c.status === "identique").length}/${comparisons.length}`);
  console.log(`Persistance : ${persistence.ok ? "OK" : "ÉCHEC"} — ${persistence.detail}`);

  const corrections = [
    "Extraction PDF page par page via pdf-parse (même pipeline que la bibliothèque Flora)",
    "Classification DocumentClassifier + MetadataExtractor (étape pré-analyse UI)",
    "Méthode MHM détectée via pattern générique filename + texte",
  ];

  writeReport({ raw, snapshot, comparisons, persistence, corrections });
  console.log(`Rapport : ${REPORT_OUT}`);

  if (blocking.length > 0 || raw.pageCount !== 50 || !persistence.ok) {
    process.exit(1);
  }

  console.log("\nTest réel MHM : SUCCÈS");
}

main().catch((error) => {
  console.error("Test réel MHM ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
