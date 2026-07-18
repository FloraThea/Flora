import fs from "node:fs";
import { documentClassifier } from "@/lib/documents/import/DocumentClassifier";
import { MetadataExtractor } from "@/lib/documents/import/MetadataExtractor";
import type { GuideValidationSnapshot } from "./snapshot-types";

const KEYWORD_PATTERNS = [
  { label: "compétence", pattern: /comp[ée]tence/i },
  { label: "objectif", pattern: /objectif/i },
  { label: "déroulement", pattern: /d[ée]roulement/i },
  { label: "matériel", pattern: /mat[ée]riel/i },
  { label: "ressource", pattern: /ressource/i },
  { label: "séance", pattern: /s[ée]ance/i },
  { label: "séquence", pattern: /s[ée]quence/i },
  { label: "MHM", pattern: /\bmhm\b|mains libres/i },
];

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number | null }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").replace(/\u0000/g, "").trim();
    return { text, pageCount: result.total ?? null };
  } finally {
    await parser.destroy();
  }
}

export async function extractGuideSnapshot(
  buffer: Buffer,
  fileName: string,
): Promise<GuideValidationSnapshot> {
  const warnings: string[] = [];
  let text = "";
  let pageCount: number | null = null;

  try {
    const extracted = await extractPdfText(buffer);
    text = extracted.text;
    pageCount = extracted.pageCount;
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Extraction PDF impossible.");
  }

  if (text.length < 80) {
    warnings.push("Texte PDF insuffisant — document peut être scanné.");
  }

  const documentType = documentClassifier.classify({ filename: fileName, text });
  const metadata = new MetadataExtractor().extract({
    filename: fileName,
    text,
    pageCount,
    fileSize: buffer.length,
  });
  const keywordsFound = KEYWORD_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );

  const countMatches = (pattern: RegExp) => (text.match(new RegExp(pattern.source, "gi")) ?? []).length;

  return {
    kind: "guides_maitre",
    fileName,
    documentType,
    methodDetected: metadata.methode || (/\bmhm\b/i.test(text) ? "MHM" : ""),
    stats: {
      textLength: text.length,
      pageCount,
      competenceMatches: countMatches(/comp[ée]tence/i),
      objectifMatches: countMatches(/objectif/i),
      deroulementMatches: countMatches(/d[ée]roulement/i),
      materielMatches: countMatches(/mat[ée]riel/i),
      ressourceMatches: countMatches(/ressource/i),
    },
    preview: text.slice(0, 1200),
    keywordsFound,
    warnings,
  };
}

export async function loadGuideSnapshot(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  return extractGuideSnapshot(buffer, filePath.split("/").pop() ?? filePath);
}
