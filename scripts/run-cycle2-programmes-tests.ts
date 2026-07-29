import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";
import {
  extractCycle2Programmes,
  inferCycle2ProgrammesMetadata,
  isCycle2ProgrammesFormat,
} from "@/lib/referentiel/bo-faithful/extract-cycle2-programmes";
import { extractBoFaithfully } from "@/lib/referentiel/bo-faithful/extract-faithful";
import { inferBoMetadata } from "@/lib/referentiel/bo-section-splitter";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURES = [
  {
    label: "Maths Cycle 2",
    envKey: "FLORA_CYCLE2_MATHS_PDF",
    defaultPath:
      "/Users/camille/Library/Messages/Attachments/bc/12/0E7D1C59-0246-4559-8C05-02A19DFFAF92/Programmes-CYCLE-2-MATHS.pdf",
    matiere: "Mathématiques",
    minCompetences: 150,
    minSousMatieres: 4,
  },
  {
    label: "EMC Cycle 2",
    envKey: "FLORA_CYCLE2_EMC_PDF",
    defaultPath:
      "/Users/camille/Library/Messages/Attachments/13/03/F6004409-16C5-4E11-AABC-68B4723B02B7/Programmes-Cycle-2-EMC.pdf",
    matiere: "EMC",
    minCompetences: 25,
    minSousMatieres: 3,
  },
  {
    label: "EVAR Cycle 2",
    envKey: "FLORA_CYCLE2_EVAR_PDF",
    defaultPath:
      "/Users/camille/Library/Messages/Attachments/1d/13/F3D76C94-DCDC-49A2-BEEE-9B36311E9498/Programmes-Cycle-2-EVAR.pdf",
    matiere: "EMC",
    minCompetences: 30,
    minSousMatieres: 1,
  },
];

function resolvePdfPath(envKey: string, defaultPath: string): string | null {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv && readFileSync(fromEnv)) return path.resolve(fromEnv);
  try {
    readFileSync(defaultPath);
    return defaultPath;
  } catch {
    return null;
  }
}

async function main() {
  let failed = 0;

  for (const fixture of FIXTURES) {
    const pdfPath = resolvePdfPath(fixture.envKey, fixture.defaultPath);
    if (!pdfPath) {
      console.warn(`Skipping missing PDF: ${fixture.label}`);
      continue;
    }

    const buffer = readFileSync(pdfPath);
    const fileName = path.basename(pdfPath);
    const extraction = await extractPdfBuffer(buffer);

    if (!isCycle2ProgrammesFormat(extraction.text)) {
      console.error(`FAIL ${fixture.label}: format Cycle 2 non détecté`);
      failed += 1;
      continue;
    }

    const titleMeta = inferCycle2ProgrammesMetadata(extraction.text, fileName);
    const metadata = inferBoMetadata(extraction.text, fileName);
    const faithful = extractBoFaithfully({
      text: extraction.text,
      cycle: metadata.cycle,
      matiere: metadata.matiere,
    });

    console.log(`\n=== ${fixture.label} ===`);
    console.log("method:", faithful.extractionMethod);
    console.log("matiere:", metadata.matiere, "| title:", titleMeta.matiere);
    console.log("competences:", faithful.quality.totalCompetences);
    console.log("sous-matieres:", Object.keys(faithful.quality.competencesBySousMatiere).length);
    console.log("niveaux:", faithful.quality.competencesByNiveau);

    if (metadata.matiere !== fixture.matiere) {
      console.error(`FAIL: matière attendue ${fixture.matiere}, obtenue ${metadata.matiere}`);
      failed += 1;
    }

    if (faithful.extractionMethod !== "cycle2_programmes_v1") {
      console.error("FAIL: mauvaise méthode d'extraction");
      failed += 1;
    }

    if (faithful.quality.totalCompetences < fixture.minCompetences) {
      console.error(`FAIL: ${faithful.quality.totalCompetences} < ${fixture.minCompetences} compétences`);
      failed += 1;
    }

    if (Object.keys(faithful.quality.competencesBySousMatiere).length < fixture.minSousMatieres) {
      console.error(`FAIL: pas assez de sous-matières`);
      failed += 1;
    }

    if (!faithful.quality.passed) {
      console.error("FAIL: quality report not passed");
      failed += 1;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} test(s) en échec`);
    process.exit(1);
  }

  console.log(`\nTous les tests Cycle 2 programmes passent (${ROOT}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
