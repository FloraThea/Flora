import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTextFromFile } from "@/lib/documents/extract-text";
import { extractBoFaithfully } from "@/lib/referentiel/bo-faithful/extract-faithful";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF_DIR = path.join(ROOT, "tests/validation/referentiel");

const FILES = [
  {
    label: "Français cycle 2",
    path: path.join(REF_DIR, "Programme_francais_cycle2-403818.pdf"),
    cycle: "Cycle 2",
    matiere: "Français",
    minCompetences: 30,
  },
  {
    label: "EVAR élémentaire",
    path: path.join(REF_DIR, "Programme_EVAR_elementaire-405261.pdf"),
    cycle: "Cycle 2",
    matiere: "EMC",
    minCompetences: 5,
    minNiveauCoverage: 3,
  },
  {
    label: "EMC moral et civique cycle 2",
    path: path.join(REF_DIR, "ensel714_annexe1_emc_cycle2-1312885.pdf"),
    cycle: "Cycle 2",
    matiere: "EMC",
    domaine: "Enseignement moral et civique",
    minCompetences: 10,
  },
].filter((file) => {
  try {
    readFileSync(file.path);
    return true;
  } catch {
    console.warn(`Skipping missing reference PDF: ${file.path}`);
    return false;
  }
});

async function main() {
  let failed = 0;

  for (const file of FILES) {
    const buf = readFileSync(file.path);
    const pdf = new File([buf], "bo.pdf", { type: "application/pdf" });
    const extracted = await extractTextFromFile(pdf);
    const result = extractBoFaithfully({
      text: extracted.text,
      cycle: file.cycle,
      matiere: file.matiere,
      domaine: "domaine" in file ? file.domaine : undefined,
    });

    console.log(`\n=== ${file.label} ===`);
    console.log("chars:", extracted.textLength);
    console.log("introduction:", result.introduction.length);
    console.log("competences:", result.quality.totalCompetences);
    console.log("tables:", result.quality.tablesDetected);
    console.log("by sousMatiere:", result.quality.competencesBySousMatiere);
    console.log("by niveau:", result.quality.competencesByNiveau);
    console.log("to review:", result.quality.competencesToReview);
    console.log("warnings:", result.quality.warnings);

    if (result.quality.totalCompetences < file.minCompetences) {
      console.error(`FAIL: expected >= ${file.minCompetences} competences`);
      failed += 1;
    }

    if (!result.quality.passed) {
      console.error("FAIL: quality report not passed");
      failed += 1;
    }

    if ("minNiveauCoverage" in file && file.minNiveauCoverage) {
      const specifiedNiveaux = Object.entries(result.quality.competencesByNiveau).filter(
        ([niveau, count]) => count > 0 && niveau !== "Non précisé" && niveau !== "",
      );
      if (specifiedNiveaux.length < file.minNiveauCoverage) {
        console.error(
          `FAIL: expected >= ${file.minNiveauCoverage} niveaux précisés, got ${specifiedNiveaux.length}`,
        );
        failed += 1;
      }
    }

    if (file.label === "Français cycle 2") {
      const invalid = result.competences.filter(
        (item) => !["CP", "CE1", "CE2"].includes(item.hierarchy.niveau),
      );
      if (invalid.length > 0) {
        console.error(`FAIL: ${invalid.length} compétence(s) sans niveau cycle 2 strict`);
        failed += 1;
      }
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} failure(s)`);
  } else {
    console.log("\nAll BO faithful tests passed.");
  }
}

void main();
