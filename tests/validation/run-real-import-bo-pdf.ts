/**
 * Test réel — Bulletin officiel PDF (chemin utilisateur)
 * Usage :
 *   FLORA_VALIDATION_BO_PDF="/chemin/vers/bo.pdf" node --env-file=.env.local node_modules/tsx/dist/cli.mjs tests/validation/run-real-import-bo-pdf.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";
import { inferBoMetadata, splitBoTextIntoSections } from "@/lib/referentiel/bo-section-splitter";
import { validateBoExtraction } from "@/lib/referentiel/bo-validator";
import { documentClassifier } from "@/lib/documents/import/DocumentClassifier";
import { MetadataExtractor } from "@/lib/documents/import/MetadataExtractor";

function resolveBoPdfPath(): string {
  const fromEnv = process.env.FLORA_VALIDATION_BO_PDF?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);

  const downloads = "/Users/camille/Downloads";
  if (fs.existsSync(downloads)) {
    const match = fs
      .readdirSync(downloads)
      .find((name) => name.endsWith("-405261.pdf") || /405261\.pdf$/i.test(name));
    if (match) return path.join(downloads, match);
  }

  throw new Error(
    "PDF BO introuvable. Définissez FLORA_VALIDATION_BO_PDF ou placez le fichier dans ~/Downloads.",
  );
}

async function main() {
  const filePath = resolveBoPdfPath();

  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const reportOut = path.resolve(process.cwd(), "docs/validation-reelle-bo-pdf.md");

  console.log(`\n→ Extraction PDF BO : ${fileName}`);
  console.log(`  Taille : ${buffer.length} octets`);

  const extraction = await extractPdfBuffer(buffer);

  assert.equal(extraction.usedOcr, false, "Un BO textuel ne doit pas déclencher l'OCR");
  assert.equal(extraction.pdfKind, "text", `Type PDF inattendu : ${extraction.pdfKind}`);
  assert.ok(extraction.textLength > 500, `Texte trop court : ${extraction.textLength} caractères`);

  const metadata = inferBoMetadata(extraction.text);
  const sections = splitBoTextIntoSections(extraction.text);
  const classifiedType = documentClassifier.classify({ filename: fileName, text: extraction.text });
  const docMeta = new MetadataExtractor().extract({
    filename: fileName,
    text: extraction.text,
    pageCount: extraction.pageCount,
    fileSize: buffer.length,
  });
  const validation = validateBoExtraction({
    competences: [],
    sections,
    matiere: metadata.matiere,
  });

  const lines = [
    "# Validation réelle — Bulletin officiel PDF",
    "",
    `- Fichier : \`${filePath}\``,
    `- Date : ${new Date().toISOString()}`,
    "",
    "## Extraction",
    "",
    `- Pages : ${extraction.pageCount ?? "?"}`,
    `- Caractères extraits : ${extraction.textLength}`,
    `- Type PDF : **${extraction.pdfKind}**`,
    `- Couche texte : ${extraction.hasTextLayer ? "oui" : "non"}`,
    `- OCR : ${extraction.usedOcr ? "oui" : "non"}`,
    `- Méthode : ${extraction.extractionMethod}`,
    `- Durée : ${extraction.diagnostics?.durationMs ?? "?"} ms`,
    `- Pages avec texte : ${extraction.diagnostics?.pagesWithText ?? "?"}`,
    "",
    "## Interprétation Flora",
    "",
    `- Type document : ${classifiedType}`,
    `- Matière inférée : ${metadata.matiere}`,
    `- Cycle : ${metadata.cycle}`,
    `- Domaine : ${metadata.domaine}`,
    `- Discipline (metadata) : ${docMeta.discipline}`,
    `- Sections repérées : ${sections.length}`,
    "",
    "## Aperçu texte",
    "",
    "```",
    extraction.preview,
    "```",
    "",
    "## Validation BO (sans IA)",
    "",
    `- Avertissements : ${validation.warnings.length === 0 ? "aucun" : validation.warnings.join(" ; ")}`,
    "",
  ];

  fs.mkdirSync(path.dirname(reportOut), { recursive: true });
  fs.writeFileSync(reportOut, `${lines.join("\n")}\n`);

  console.log(`✓ Extraction OK — ${extraction.pageCount} pages, ${extraction.textLength} caractères, OCR=${extraction.usedOcr ? "oui" : "non"}`);
  console.log(`✓ Matière : ${metadata.matiere}, sections : ${sections.length}`);
  console.log(`Rapport : ${reportOut}`);
  console.log("\nTest BO PDF : SUCCÈS");
}

main().catch((error) => {
  console.error("\nTest BO PDF : ÉCHEC", error instanceof Error ? error.message : error);
  process.exit(1);
});
