/**
 * Tests automatiques — séparation stricte des compétences BO par niveau.
 * Usage : node node_modules/tsx/dist/cli.mjs scripts/run-bo-niveau-separation-tests.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTextFromFile } from "@/lib/documents/extract-text";
import { extractBoFaithfully } from "@/lib/referentiel/bo-faithful/extract-faithful";
import {
  detectAllSchoolNiveauxFromLine,
  detectSchoolNiveauFromLine,
  isStrictSchoolNiveau,
  niveauMatchesStrict,
  normalizeSchoolNiveau,
} from "@/lib/referentiel/niveau-utils";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF_DIR = path.join(ROOT, "tests/validation/referentiel");

function testNiveauDetection(): void {
  assert.equal(normalizeSchoolNiveau("CP"), "CP");
  assert.equal(normalizeSchoolNiveau("Cours préparatoire"), "CP");
  assert.equal(normalizeSchoolNiveau("CE1"), "CE1");
  assert.equal(normalizeSchoolNiveau("Cours élémentaire première année"), "CE1");
  assert.equal(normalizeSchoolNiveau("CE2"), "CE2");
  assert.equal(normalizeSchoolNiveau("Cours élémentaire deuxième année"), "CE2");
  assert.equal(detectSchoolNiveauFromLine("➜ CP"), "CP");
  assert.deepEqual(detectAllSchoolNiveauxFromLine("CP CE1 CE2"), ["CP", "CE1", "CE2"]);
  console.log("✓ Détection des niveaux");
}

function assertEachCompetenceHasSingleNiveau(
  competences: Array<{ hierarchy: { niveau: string }; competence: string }>,
  label: string,
): void {
  for (const item of competences) {
    assert.ok(
      isStrictSchoolNiveau(item.hierarchy.niveau),
      `${label}: niveau invalide « ${item.hierarchy.niveau} » pour « ${item.competence.slice(0, 40)}… »`,
    );
  }

  const counts = { CP: 0, CE1: 0, CE2: 0 };
  for (const item of competences) {
    const niveau = item.hierarchy.niveau as keyof typeof counts;
    if (niveau in counts) counts[niveau] += 1;
  }
  console.log(`  ${label}: CP=${counts.CP}, CE1=${counts.CE1}, CE2=${counts.CE2}`);
}

function testSyntheticFixtures(): void {
  const cpOnly = extractBoFaithfully({
    text: `
Langage oral
Objectifs d'apprentissage Exemples de réussite
CP
- Écouter pour comprendre un message oral court.
- Prendre la parole en respectant les règles.
`,
    cycle: "Cycle 2",
    matiere: "Français",
    documentNiveaux: "CP",
  });

  assert.ok(cpOnly.competences.length >= 2, "CP-only: compétences attendues");
  assert.ok(
    cpOnly.competences.every((item) => item.hierarchy.niveau === "CP"),
    "CP-only: toutes les compétences doivent être CP",
  );

  const ce1Only = extractBoFaithfully({
    text: `
Lecture
Objectifs d'apprentissage Exemples de réussite
CE1
- Lire à voix haute un texte adapté avec fluidité.
- Comprendre un texte narratif simple.
`,
    cycle: "Cycle 2",
    matiere: "Français",
    documentNiveaux: "CE1",
  });

  assert.ok(ce1Only.competences.every((item) => item.hierarchy.niveau === "CE1"));

  const ce2Only = extractBoFaithfully({
    text: `
Écriture
Objectifs d'apprentissage Exemples de réussite
CE2
- Produire un écrit court en respectant les contraintes.
- Réviser un brouillon pour améliorer sa clarté.
`,
    cycle: "Cycle 2",
    matiere: "Français",
    documentNiveaux: "CE2",
  });

  assert.ok(ce2Only.competences.every((item) => item.hierarchy.niveau === "CE2"));

  const combined = extractBoFaithfully({
    text: `
Langage oral
Objectifs d'apprentissage Exemples de réussite
CP
- Écouter pour comprendre un message oral court.
CE1
- Écouter pour comprendre un message oral plus complexe.
CE2
- Écouter pour comprendre un message oral argumenté.
`,
    cycle: "Cycle 2",
    matiere: "Français",
    documentNiveaux: "CP, CE1, CE2",
  });

  assert.ok(combined.competences.some((item) => item.hierarchy.niveau === "CP"));
  assert.ok(combined.competences.some((item) => item.hierarchy.niveau === "CE1"));
  assert.ok(combined.competences.some((item) => item.hierarchy.niveau === "CE2"));
  assertEachCompetenceHasSingleNiveau(combined.competences, "BO combiné CP/CE1/CE2");

  console.log("✓ Fixtures synthétiques CP / CE1 / CE2 / combiné");
}

async function testReferencePdf(): Promise<void> {
  const pdfPath = path.join(REF_DIR, "Programme_francais_cycle2-403818.pdf");
  let buffer: Buffer;
  try {
    buffer = readFileSync(pdfPath);
  } catch {
    console.warn("⚠ PDF français cycle 2 absent — test référence ignoré");
    return;
  }

  const pdf = new File([buffer], "bo.pdf", { type: "application/pdf" });
  const extracted = await extractTextFromFile(pdf);
  const result = extractBoFaithfully({
    text: extracted.text,
    cycle: "Cycle 2",
    matiere: "Français",
    documentNiveaux: "CP, CE1, CE2",
  });

  assert.ok(result.competences.length >= 30, "PDF français: compétences insuffisantes");
  assert.ok(
    result.competences.every((item) => isStrictSchoolNiveau(item.hierarchy.niveau)),
    "PDF français: niveau strict requis pour chaque compétence",
  );

  const niveaux = new Set(result.competences.map((item) => item.hierarchy.niveau));
  assert.ok(niveaux.has("CP") || niveaux.has("CE1") || niveaux.has("CE2"), "PDF français: au moins un niveau cycle 2");

  assertEachCompetenceHasSingleNiveau(result.competences, "PDF français cycle 2");
  console.log("✓ PDF référence français cycle 2");
  console.log("  by niveau:", result.quality.competencesByNiveau);
  console.log("  to review:", result.quality.competencesToReview);
}

function testSearchFilter(): void {
  assert.ok(niveauMatchesStrict("CE1", "CE1"));
  assert.ok(!niveauMatchesStrict("CP", "CE1"));
  assert.ok(!niveauMatchesStrict("Non précisé", "CE1"));
  assert.ok(!niveauMatchesStrict("", "CE2"));
  console.log("✓ Filtre recherche strict par niveau");
}

async function main() {
  testNiveauDetection();
  testSyntheticFixtures();
  testSearchFilter();
  await testReferencePdf();
  console.log("\nTous les tests de séparation par niveau ont réussi.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
