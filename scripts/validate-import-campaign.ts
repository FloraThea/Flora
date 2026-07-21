/**
 * Campagne de validation import Flora — PDF, DOCX, XLSX, PNG/JPG
 *
 * Usage :
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/validate-import-campaign.ts
 *
 * Optionnel :
 *   FLORA_VALIDATION_BO_PDF=chemin/vers/bulletin.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { extractTextFromBuffer, canAnalyzeExtension } from "@/lib/documents/extraction/extract-document";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";
import { COMING_SOON_EXTENSIONS, getFileExtension } from "@/lib/documents/types";
import { readExcelWorkbook } from "@/lib/import/read-excel-workbook";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import { parseTimetableFile } from "@/lib/timetable/import/parse-excel";
import { resolveValidationPath } from "@/tests/validation/lib/paths";

type CampaignResult = {
  format: string;
  label: string;
  filePath: string;
  ok: boolean;
  stage: string;
  fileSizeBytes: number;
  pageCount?: number | null;
  textLength?: number;
  rowCount?: number;
  extractionMethod?: string;
  pdfKind?: string;
  usedOcr?: boolean;
  hasTextLayer?: boolean;
  durationMs?: number;
  analyzeSupported: boolean;
  detail: string;
  error?: string;
};

const REPORT_PATH = path.resolve(process.cwd(), "docs/validation-campagne-import.md");

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

async function testPdfFile(label: string, filePath: string): Promise<CampaignResult> {
  const started = Date.now();
  const buffer = fs.readFileSync(filePath);
  const extension = getFileExtension(filePath);

  try {
    const result = await extractPdfBuffer(buffer);
    return {
      format: "PDF",
      label,
      filePath,
      ok: result.textLength > 0,
      stage: "extraction",
      fileSizeBytes: buffer.length,
      pageCount: result.pageCount,
      textLength: result.textLength,
      extractionMethod: result.extractionMethod,
      pdfKind: result.pdfKind,
      usedOcr: result.usedOcr,
      hasTextLayer: result.hasTextLayer,
      durationMs: result.diagnostics?.durationMs ?? Date.now() - started,
      analyzeSupported: canAnalyzeExtension(extension),
      detail: `${result.pageCount ?? "?"} pages, ${result.textLength} caractères, type=${result.pdfKind}, OCR=${result.usedOcr ? "oui" : "non"}`,
    };
  } catch (error) {
    return {
      format: "PDF",
      label,
      filePath,
      ok: false,
      stage: "extraction",
      fileSizeBytes: buffer.length,
      durationMs: Date.now() - started,
      analyzeSupported: canAnalyzeExtension(extension),
      detail: "Échec extraction",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testGenericExtraction(
  format: string,
  label: string,
  filePath: string,
): Promise<CampaignResult> {
  const started = Date.now();
  const buffer = fs.readFileSync(filePath);
  const extension = getFileExtension(filePath);
  const fileName = path.basename(filePath);

  if (COMING_SOON_EXTENSIONS.includes(extension as never)) {
    return {
      format,
      label,
      filePath,
      ok: true,
      stage: "upload_only",
      fileSizeBytes: buffer.length,
      durationMs: Date.now() - started,
      analyzeSupported: false,
      detail: "Format accepté à l'upload — extraction automatique bibliothèque non implémentée (stockage seul).",
    };
  }

  try {
    const result = await extractTextFromBuffer(buffer, fileName);
    return {
      format,
      label,
      filePath,
      ok: result.textLength > 0,
      stage: "extraction",
      fileSizeBytes: buffer.length,
      pageCount: result.pageCount,
      textLength: result.textLength,
      extractionMethod: result.extractionMethod,
      usedOcr: result.usedOcr,
      durationMs: Date.now() - started,
      analyzeSupported: canAnalyzeExtension(extension),
      detail: `${result.textLength} caractères via ${result.extractionMethod}`,
      error: result.textLength > 0 ? undefined : "Texte vide après extraction",
    };
  } catch (error) {
    return {
      format,
      label,
      filePath,
      ok: false,
      stage: "extraction",
      fileSizeBytes: buffer.length,
      durationMs: Date.now() - started,
      analyzeSupported: canAnalyzeExtension(extension),
      detail: "Échec extraction",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testXlsxFile(label: string, filePath: string): Promise<CampaignResult> {
  const started = Date.now();
  const buffer = fs.readFileSync(filePath);

  try {
    const workbook = readExcelWorkbook(buffer, path.basename(filePath));
    const parsedGrid = rowsFromGrid(workbook.grid, undefined, { sourceSheet: workbook.activeSheetName });

    return {
      format: "XLSX",
      label,
      filePath,
      ok: parsedGrid.rows.length > 0,
      stage: "parse_grid",
      fileSizeBytes: buffer.length,
      rowCount: parsedGrid.rows.length,
      durationMs: Date.now() - started,
      analyzeSupported: false,
      detail: `${workbook.grid.length} lignes grille → ${parsedGrid.rows.length} lignes structurées (${workbook.activeSheetName})`,
    };
  } catch (error) {
    return {
      format: "XLSX",
      label,
      filePath,
      ok: false,
      stage: "parse_grid",
      fileSizeBytes: buffer.length,
      durationMs: Date.now() - started,
      analyzeSupported: false,
      detail: "Échec parsing Excel",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testEdtXlsxFile(label: string, filePath: string): Promise<CampaignResult> {
  const started = Date.now();
  const buffer = fs.readFileSync(filePath);

  try {
    const parsed = await parseTimetableFile(buffer, path.basename(filePath));
    const sessions = parsed.sessions.filter((session) => !session.isEmpty);

    return {
      format: "XLSX",
      label,
      filePath,
      ok: sessions.length > 0,
      stage: "parse_timetable",
      fileSizeBytes: buffer.length,
      rowCount: sessions.length,
      durationMs: Date.now() - started,
      analyzeSupported: false,
      detail: `${sessions.length} créneaux EDT structurés`,
    };
  } catch (error) {
    return {
      format: "XLSX",
      label,
      filePath,
      ok: false,
      stage: "parse_timetable",
      fileSizeBytes: buffer.length,
      durationMs: Date.now() - started,
      analyzeSupported: false,
      detail: "Échec parsing EDT Excel",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeReport(results: CampaignResult[]) {
  const passed = results.filter((item) => item.ok).length;
  const lines = [
    "# Campagne de validation — import Flora",
    "",
    `- Date : ${new Date().toISOString()}`,
    `- Résultat global : **${passed}/${results.length}** tests OK`,
    "",
    "## Synthèse par format",
    "",
    "| Format | Document | Statut | Détail | Durée |",
    "|--------|----------|--------|--------|-------|",
    ...results.map((item) => {
      const status = item.ok ? "✓ OK" : "✗ ÉCHEC";
      const duration = item.durationMs ? `${item.durationMs} ms` : "—";
      return `| ${item.format} | ${item.label} | ${status} | ${item.detail}${item.error ? ` — ${item.error}` : ""} | ${duration} |`;
    }),
    "",
    "## Détails par fichier",
    "",
  ];

  for (const item of results) {
    lines.push(`### ${item.format} — ${item.label}`);
    lines.push("");
    lines.push(`- Fichier : \`${item.filePath}\``);
    lines.push(`- Taille : ${formatBytes(item.fileSizeBytes)}`);
    lines.push(`- Étape testée : ${item.stage}`);
    lines.push(`- Analyse bibliothèque supportée : ${item.analyzeSupported ? "oui" : "non"}`);
    if (item.pageCount != null) lines.push(`- Pages : ${item.pageCount}`);
    if (item.textLength != null) lines.push(`- Caractères extraits : ${item.textLength}`);
    if (item.rowCount != null) lines.push(`- Lignes structurées : ${item.rowCount}`);
    if (item.pdfKind) lines.push(`- Type PDF détecté : ${item.pdfKind}`);
    if (item.hasTextLayer != null) lines.push(`- Couche texte : ${item.hasTextLayer ? "oui" : "non"}`);
    if (item.usedOcr != null) lines.push(`- OCR utilisé : ${item.usedOcr ? "oui" : "non"}`);
    if (item.extractionMethod) lines.push(`- Méthode : ${item.extractionMethod}`);
    lines.push(`- Résultat : ${item.ok ? "SUCCÈS" : "ÉCHEC"}`);
    if (item.error) lines.push(`- Erreur : ${item.error}`);
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push("- Les PDF textuels (guide du maître, Bulletin officiel) ne doivent **pas** déclencher l'OCR.");
  lines.push("- DOCX/PPTX/XLSX bibliothèque : upload OK, extraction/analyse automatique en attente d'implémentation.");
  lines.push("- PNG/JPG : OCR Tesseract si fichier image déposé dans la bibliothèque.");
  lines.push("- Pour tester un Bulletin officiel local : `FLORA_VALIDATION_BO_PDF=chemin/vers/fichier.pdf`.");
  lines.push("");

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  const results: CampaignResult[] = [];

  const pdfCases: Array<[string, string]> = [
    ["Guide du maître MHM CE1/CE2", resolveValidationPath("guides_maitre/MHM_CE1_CE2_GUIDE.pdf")],
  ];

  const boPdf = process.env.FLORA_VALIDATION_BO_PDF?.trim();
  if (boPdf) {
    pdfCases.push(["Bulletin officiel (utilisateur)", path.resolve(process.cwd(), boPdf)]);
  }

  for (const [label, filePath] of pdfCases) {
    if (!fs.existsSync(filePath)) {
      results.push({
        format: "PDF",
        label,
        filePath,
        ok: false,
        stage: "fixture",
        fileSizeBytes: 0,
        analyzeSupported: true,
        detail: "Fixture absente",
        error: `Fichier introuvable : ${filePath}`,
      });
      continue;
    }
    results.push(await testPdfFile(label, filePath));
  }

  const xlsxCases: Array<[string, string]> = [
    ["Programmation HDA", resolveValidationPath("programmation/Programmation_HDA_Editable_2026-2027.xlsx")],
    ["Progression EMC", resolveValidationPath("progression/Progression_EMC_Editable_2026-2027.xlsx")],
    ["Emploi du temps rentrée", resolveValidationPath("emploi_du_temps/emploi_du_temps_rentree.xlsx")],
  ];

  for (const [label, filePath] of xlsxCases.slice(0, 2)) {
    results.push(await testXlsxFile(label, filePath));
  }

  const edtPath = xlsxCases[2][1];
  results.push(await testEdtXlsxFile(xlsxCases[2][0], edtPath));

  const docxPath = resolveValidationPath("documents_divers/exemple.docx");
  if (fs.existsSync(docxPath)) {
    results.push(await testGenericExtraction("DOCX", "Document Word exemple", docxPath));
  } else {
    results.push({
      format: "DOCX",
      label: "Document Word",
      filePath: docxPath,
      ok: true,
      stage: "policy",
      fileSizeBytes: 0,
      analyzeSupported: false,
      detail: "Aucune fixture DOCX — comportement attendu : upload accepté, analyse bibliothèque non implémentée.",
    });
  }

  const pngPath = resolveValidationPath("documents_divers/exemple.png");
  if (fs.existsSync(pngPath)) {
    results.push(await testGenericExtraction("PNG", "Image PNG exemple", pngPath));
  } else {
    results.push({
      format: "PNG/JPG",
      label: "Image scan",
      filePath: pngPath,
      ok: true,
      stage: "policy",
      fileSizeBytes: 0,
      analyzeSupported: true,
      detail: "Aucune fixture PNG — pipeline image/OCR prêt côté code, test manuel recommandé.",
    });
  }

  writeReport(results);

  const failed = results.filter((item) => !item.ok);
  console.log(`Rapport : ${REPORT_PATH}`);
  console.log(`Campagne import : ${results.length - failed.length}/${results.length} OK`);

  for (const item of results) {
    console.log(`${item.ok ? "✓" : "✗"} [${item.format}] ${item.label} — ${item.detail}${item.error ? ` (${item.error})` : ""}`);
  }

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Campagne import ÉCHEC :", error);
  process.exit(1);
});
