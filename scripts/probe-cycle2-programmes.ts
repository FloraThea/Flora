/**
 * Probe extraction des programmes Cycle 2 officiels.
 * Usage : node node_modules/tsx/dist/cli.mjs scripts/probe-cycle2-programmes.ts [pdf...]
 */
import fs from "node:fs";
import path from "node:path";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";
import { extractBoFaithfully, mapFaithfulResultToDrafts } from "@/lib/referentiel/bo-faithful/extract-faithful";
import { inferBoMetadata } from "@/lib/referentiel/bo-section-splitter";

const DEFAULT_FILES = [
  "/Users/camille/Library/Messages/Attachments/1d/13/F3D76C94-DCDC-49A2-BEEE-9B36311E9498/Programmes-Cycle-2-EVAR.pdf",
  "/Users/camille/Library/Messages/Attachments/aa/10/07D3179A-552F-4F57-8FD4-DD7C02E58257/Programmes-Cycle-2-Langues-vivantes.pdf",
  "/Users/camille/Library/Messages/Attachments/13/03/F6004409-16C5-4E11-AABC-68B4723B02B7/Programmes-Cycle-2-EMC.pdf",
  "/Users/camille/Library/Messages/Attachments/9c/12/DBB50FD9-0153-480A-8F17-4BD400A04041/Programmes-Cycle-2-Histoire-Geographie.pdf",
  "/Users/camille/Library/Messages/Attachments/31/01/CA3A87C9-21AC-4E6B-B3D3-00D8A5411BD4/Programmes-CYCLE-2-FR.pdf",
  "/Users/camille/Library/Messages/Attachments/bc/12/0E7D1C59-0246-4559-8C05-02A19DFFAF92/Programmes-CYCLE-2-MATHS.pdf",
  "/Users/camille/Library/Messages/Attachments/57/07/CC82F710-4A87-4C24-9202-458A5B20E9C7/Programmes-Cycle-2-Sciences-et-technologie.pdf",
];

async function probeFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const extraction = await extractPdfBuffer(buffer);
  const metadata = inferBoMetadata(extraction.text, path.basename(filePath));
  const faithful = extractBoFaithfully({
    text: extraction.text,
    cycle: metadata.cycle,
    matiere: metadata.matiere,
  });
  const { confirmed, toReview } = mapFaithfulResultToDrafts(faithful, {
    cycle: metadata.cycle,
    matiere: metadata.matiere,
  });

  return {
    fileName: path.basename(filePath),
    metadata,
    textLength: extraction.textLength,
    pageCount: extraction.pageCount,
    tablesDetected: faithful.quality.tablesDetected,
    tablesProcessed: faithful.quality.tablesProcessed,
    confirmed: confirmed.length,
    toReview: toReview.length,
    sousMatieres: faithful.quality.competencesBySousMatiere,
    niveaux: faithful.quality.competencesByNiveau,
    warnings: faithful.quality.warnings,
    sampleText: extraction.text.slice(0, 400).replace(/\s+/g, " "),
  };
}

async function main() {
  const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FILES;

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`MISSING ${filePath}`);
      continue;
    }
    const result = await probeFile(filePath);
    console.log(`\n=== ${result.fileName} ===`);
    console.log(`Meta: ${result.metadata.matiere} | ${result.metadata.cycle} | ${result.metadata.programme}`);
    console.log(`Text: ${result.textLength} chars, ${result.pageCount} pages`);
    console.log(`Tables: ${result.tablesDetected} detected, ${result.tablesProcessed} processed`);
    console.log(`Competences: ${result.confirmed} confirmed, ${result.toReview} review`);
    console.log(`Sous-matieres:`, result.sousMatieres);
    console.log(`Niveaux:`, result.niveaux);
    if (result.warnings.length) console.log(`Warnings:`, result.warnings.slice(0, 5));
    console.log(`Sample: ${result.sampleText.slice(0, 200)}…`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
