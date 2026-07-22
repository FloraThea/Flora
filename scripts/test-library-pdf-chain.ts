/**
 * Test chaîne complète bibliothèque : extraction PDF + analyse Théa + persistance.
 *
 * Usage :
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/test-library-pdf-chain.ts [chemin.pdf]
 *   FLORA_VALIDATION_BASE_URL=http://localhost:3000 node --env-file=.env.local ... (ajoute test HTTP)
 */
import fs from "node:fs";
import path from "node:path";
import { extractPdfBuffer } from "../lib/documents/extraction/pdf-extractor";
import { extractTextFromFile } from "../lib/documents/extract-text";

const DEFAULT_PDF =
  "/Users/camille/Desktop/École Camille/5.Mathématiques/MHM CE1 CE2 GUIDE.pdf";
const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL?.trim();

function buildFile(pdfPath: string): File {
  const buffer = fs.readFileSync(pdfPath);
  const fileName = path.basename(pdfPath);
  return new File([buffer], fileName, { type: "application/pdf" });
}

async function testDirectExtraction(pdfPath: string) {
  console.log("\n=== 1. Extraction buffer (extractPdfBuffer) ===");
  const buffer = fs.readFileSync(pdfPath);
  const result = await extractPdfBuffer(buffer);

  console.log({
    pageCount: result.pageCount,
    textLength: result.textLength,
    extractionMethod: result.extractionMethod,
    usedOcr: result.usedOcr,
    pdfKind: result.pdfKind,
    preview: result.preview.slice(0, 120),
  });

  if (result.textLength < 50_000) {
    throw new Error(`Texte trop court (${result.textLength} car.) — extraction incomplète.`);
  }
  if (result.extractionMethod !== "pdf-text") {
    throw new Error(`Méthode inattendue : ${result.extractionMethod}`);
  }
  console.log("✓ extractPdfBuffer OK");
}

async function testFileExtraction(pdfPath: string) {
  console.log("\n=== 2. Extraction fichier (extractTextFromFile — route upload) ===");
  const file = buildFile(pdfPath);
  const result = await extractTextFromFile(file);

  console.log({
    pageCount: result.pageCount,
    textLength: result.textLength,
    extractionMethod: result.extractionMethod,
  });

  if (result.textLength < 50_000) {
    throw new Error(`extractTextFromFile : texte trop court (${result.textLength}).`);
  }
  console.log("✓ extractTextFromFile OK");
}

async function testFullImport(pdfPath: string) {
  console.log("\n=== 3. Import complet (importDocumentFromFile — Supabase + Théa) ===");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    console.log("Ignoré : NEXT_PUBLIC_SUPABASE_URL absent");
    return;
  }

  try {
    const { importDocumentFromFile } = await import("../lib/documents/import-document");
    const file = buildFile(pdfPath);
    const result = await importDocumentFromFile(file);

    console.log({
      success: result.success,
      documentId: result.document.id,
      status: result.document.status,
      title: result.document.title,
      matiere: result.document.matiere,
      chunks: result.chunks.length,
      tags: result.tags.length,
      competences: result.competences.length,
      warning: result.warning ?? null,
    });

    if (result.warning?.includes("moteur PDF") || result.warning?.includes("pdf-parse")) {
      throw new Error(`Import échoué sur PDF : ${result.warning}`);
    }

    if (!result.success) {
      throw new Error("importDocumentFromFile : success=false");
    }

    if (result.document.status !== "analysed" && !result.warning) {
      throw new Error(`Statut inattendu : ${result.document.status}`);
    }

    console.log("✓ importDocumentFromFile OK");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Client Component") || message.includes("Server Component")) {
      console.log("Ignoré hors serveur Next (valider via FLORA_VALIDATION_BASE_URL + site)");
      return;
    }
    throw error;
  }
}

async function testHttpUpload(pdfPath: string) {
  if (!BASE_URL) {
    console.log("\n=== 4. Upload HTTP : ignoré (FLORA_VALIDATION_BASE_URL absent) ===");
    return;
  }

  console.log(`\n=== 4. Upload HTTP (${BASE_URL}/api/documents/upload) ===`);

  const buffer = fs.readFileSync(pdfPath);
  const fileName = path.basename(pdfPath);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/pdf" }), fileName);

  const response = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    body: form,
  });

  const payload = (await response.json()) as {
    error?: string;
    success?: boolean;
    document?: { id?: string; status?: string; matiere?: string };
    warning?: string;
  };

  if (!response.ok) {
    throw new Error(`Upload HTTP ${response.status} : ${payload.error ?? JSON.stringify(payload)}`);
  }

  console.log({
    status: response.status,
    documentId: payload.document?.id,
    documentStatus: payload.document?.status,
    matiere: payload.document?.matiere,
    warning: payload.warning ?? null,
  });

  if (payload.warning?.includes("moteur PDF") || payload.error) {
    throw new Error(payload.warning ?? payload.error);
  }

  console.log("✓ Upload HTTP OK");
}

async function main() {
  const pdfPath = path.resolve(process.argv[2] ?? DEFAULT_PDF);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF introuvable : ${pdfPath}`);
  }

  console.log(`PDF test : ${pdfPath}`);
  await testDirectExtraction(pdfPath);
  await testFileExtraction(pdfPath);
  await testFullImport(pdfPath);
  await testHttpUpload(pdfPath);
  console.log("\n✓ Chaîne PDF bibliothèque validée");
}

main().catch((error) => {
  console.error("\n✗ Échec chaîne PDF :", error instanceof Error ? error.message : error);
  process.exit(1);
});
