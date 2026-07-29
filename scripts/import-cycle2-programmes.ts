/**
 * Import batch des programmes Cycle 2 officiels dans la bibliothèque BO.
 *
 * Usage :
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/import-cycle2-programmes.ts [pdf...]
 */
import fs from "node:fs";
import path from "node:path";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";
import { extractBoFaithfully } from "@/lib/referentiel/bo-faithful/extract-faithful";
import { inferBoMetadata } from "@/lib/referentiel/bo-section-splitter";
import { runBoImportPipeline } from "@/lib/referentiel/bo-pipeline";

const DEFAULT_FILES = [
  "/Users/camille/Library/Messages/Attachments/1d/13/F3D76C94-DCDC-49A2-BEEE-9B36311E9498/Programmes-Cycle-2-EVAR.pdf",
  "/Users/camille/Library/Messages/Attachments/aa/10/07D3179A-552F-4F57-8FD4-DD7C02E58257/Programmes-Cycle-2-Langues-vivantes.pdf",
  "/Users/camille/Library/Messages/Attachments/13/03/F6004409-16C5-4E11-AABC-68B4723B02B7/Programmes-Cycle-2-EMC.pdf",
  "/Users/camille/Library/Messages/Attachments/9c/12/DBB50FD9-0153-480A-8F17-4BD400A04041/Programmes-Cycle-2-Histoire-Geographie.pdf",
  "/Users/camille/Library/Messages/Attachments/31/01/CA3A87C9-21AC-4E6B-B3D3-00D8A5411BD4/Programmes-CYCLE-2-FR.pdf",
  "/Users/camille/Library/Messages/Attachments/bc/12/0E7D1C59-0246-4559-8C05-02A19DFFAF92/Programmes-CYCLE-2-MATHS.pdf",
  "/Users/camille/Library/Messages/Attachments/57/07/CC82F710-4A87-4C24-9202-458A5B20E9C7/Programmes-Cycle-2-Sciences-et-technologie.pdf",
];

async function importFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const extraction = await extractPdfBuffer(buffer);
  const metadata = inferBoMetadata(extraction.text, fileName);
  const preview = extractBoFaithfully({
    text: extraction.text,
    cycle: metadata.cycle,
    matiere: metadata.matiere,
  });

  console.log(`\n→ ${fileName}`);
  console.log(`  ${metadata.matiere} | ${metadata.cycle} | ${preview.extractionMethod}`);
  console.log(`  ${preview.quality.totalCompetences} compétences, ${preview.quality.tablesProcessed} tableaux`);

  if (preview.quality.totalCompetences === 0) {
    throw new Error(`Aucune compétence extraite pour ${fileName}`);
  }

  const file = new File([buffer], fileName, { type: "application/pdf" });
  const result = await runBoImportPipeline({ file, extraction, autoActivate: true });

  console.log(`  ✓ Enregistré (${result.insertedCount} compétences, statut ${result.document.status})`);
  return result;
}

async function main() {
  const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FILES;
  let failed = 0;

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`MISSING ${filePath}`);
      failed += 1;
      continue;
    }

    try {
      await importFile(filePath);
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
      failed += 1;
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
