import { IMPORT_CONFIG } from "@/lib/documents/import/config";
import {
  DocumentExtractionError,
  isInvalidPdfError,
  isPasswordProtectedError,
} from "./errors";
import { extractPdfTextWithOcr } from "./ocr-extractor";
import {
  logPdfExtractionFailure,
  logPdfExtractionStage,
  type PdfDocumentKind,
  type PdfExtractionDiagnostics,
  type PdfPageTextStats,
} from "./pdf-diagnostics";
import type { DocumentExtractionResult } from "./types";
import { createNodePdfParser, type FloraPdfParser } from "./pdf-node-runtime";
import {
  isLikelyScannedPdfHeuristic,
  MIN_TOTAL_CHARS,
} from "./pdf-heuristics";

const PREVIEW_LENGTH = 500;
const OCR_SCALE = 2;

type PdfScreenshot = {
  pageNumber: number;
  data: Uint8Array;
};

type PdfParser = FloraPdfParser;

function buildPreview(text: string): string {
  return text.slice(0, PREVIEW_LENGTH);
}

function normalizeText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim();
}

function rootCauseMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Erreur inconnue");
}

function isProtectedPdfInfo(info: Awaited<ReturnType<PdfParser["getInfo"]>>): boolean {
  const meta = info.info ?? {};
  const encryptFilter = String(meta.EncryptFilterName ?? "").trim();
  if (encryptFilter && encryptFilter.toLowerCase() !== "none") return true;

  const permission = info.permission;
  if (permission && typeof permission === "object") {
    const flags = permission as Record<string, unknown>;
    if (flags.allowCopy === false || flags.allowModify === false) {
      return false;
    }
  }

  return false;
}

async function loadPdfParser(buffer: Buffer): Promise<PdfParser> {
  return createNodePdfParser(buffer);
}

function collectNativePageTexts(
  textResult: Awaited<ReturnType<PdfParser["getText"]>>,
  pageCount: number,
): { text: string; perPageChars: PdfPageTextStats[] } {
  const perPageChars: PdfPageTextStats[] = [];

  if (Array.isArray(textResult.pages) && textResult.pages.length > 0) {
    const chunks: string[] = [];
    for (const page of textResult.pages) {
      const pageText = normalizeText(page.text ?? "");
      const pageNumber = page.num ?? perPageChars.length + 1;
      perPageChars.push({ pageNumber, charCount: pageText.length });
      if (pageText) chunks.push(pageText);
    }

    const joined = normalizeText(chunks.join("\n\n"));
    if (joined) {
      return { text: joined, perPageChars };
    }
  }

  const fullText = normalizeText(textResult.text ?? "");
  if (fullText) {
    const byFormFeed = fullText.split(/\f+/).map(normalizeText).filter(Boolean);
    if (byFormFeed.length > 1 && byFormFeed.length >= pageCount) {
      for (let index = 0; index < byFormFeed.length; index += 1) {
        perPageChars.push({ pageNumber: index + 1, charCount: byFormFeed[index].length });
      }
      return { text: normalizeText(byFormFeed.join("\n\n")), perPageChars };
    }

    perPageChars.push({ pageNumber: 1, charCount: fullText.length });
    return { text: fullText, perPageChars };
  }

  return { text: "", perPageChars };
}

function isLikelyScannedPdf(text: string, pageCount: number, pagesWithText: number): boolean {
  return isLikelyScannedPdfHeuristic(text, pageCount, pagesWithText);
}

function classifyPdfKind(input: {
  protectedPdf: boolean;
  nativeTextLength: number;
  pagesWithText: number;
  usedOcr: boolean;
  finalTextLength: number;
}): PdfDocumentKind {
  if (input.protectedPdf) return "protected";
  if (input.finalTextLength === 0) return "empty";
  if (input.usedOcr) return "scanned";
  if (input.nativeTextLength >= MIN_TOTAL_CHARS || input.pagesWithText > 0) return "text";
  return "scanned";
}

async function readNativePdfText(parser: PdfParser, pageCount: number) {
  const attempts: Array<Record<string, unknown>> = [
    { parseHyperlinks: false, lineEnforce: true },
    { parseHyperlinks: false, lineEnforce: false },
    {},
  ];

  let lastError: unknown = null;

  for (const params of attempts) {
    try {
      const textResult = await parser.getText(params);
      const collected = collectNativePageTexts(textResult, pageCount);
      if (collected.text || collected.perPageChars.some((page) => page.charCount > 0)) {
        return collected;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { text: "", perPageChars: [] as PdfPageTextStats[] };
}

async function capturePageScreenshots(
  parser: PdfParser,
  pageCount: number,
): Promise<PdfScreenshot[]> {
  const screenshots = await parser.getScreenshot({
    scale: OCR_SCALE,
    imageBuffer: true,
    imageDataUrl: false,
  });

  return screenshots.pages
    .filter((page) => page.data && page.data.length > 0)
    .map((page) => ({
      pageNumber: page.pageNumber,
      data: page.data,
    }))
    .slice(0, pageCount || screenshots.pages.length);
}

function buildParserErrorMessage(error: unknown): string {
  const cause = rootCauseMessage(error);
  if (/cannot find module ['"]pdf-parse/i.test(cause)) {
    return "Le moteur PDF serveur est indisponible (pdf-parse absent du déploiement). Contactez l'administrateur ou relancez le déploiement.";
  }
  if (/dommatrix|imagedata|path2d/i.test(cause)) {
    return `Le moteur PDF serveur n'a pas pu s'initialiser (${cause}). Vérifiez que @napi-rs/canvas est installé sur l'environnement d'exécution.`;
  }
  if (/canvas|@napi-rs\/canvas|native binding/i.test(cause)) {
    return `Le rendu des pages PDF a échoué (${cause}). Le document nécessite peut-être un OCR, mais le moteur graphique serveur est indisponible.`;
  }
  if (/timeout|délai|timed out/i.test(cause)) {
    return `L'extraction PDF a dépassé le délai autorisé (${cause}).`;
  }
  return `Le moteur PDF n'a pas pu lire le fichier (${cause}).`;
}

export async function extractPdfBuffer(buffer: Buffer): Promise<DocumentExtractionResult> {
  const startedAt = Date.now();
  const fileSizeBytes = buffer.length;
  let parser: PdfParser | null = null;

  logPdfExtractionStage("Démarrage", {
    fileSizeBytes,
    ocrEnabled: IMPORT_CONFIG.ocr.enabled,
    ocrMaxPages: IMPORT_CONFIG.ocr.maxPages,
  });

  try {
    parser = await loadPdfParser(buffer);

    let pageCount = 0;
    let protectedPdf = false;

    try {
      const info = await parser.getInfo();
      pageCount = info.total ?? 0;
      protectedPdf = isProtectedPdfInfo(info);

      logPdfExtractionStage("Métadonnées PDF", {
        pageCount,
        protectedPdf,
        producer: info.info?.Producer ?? null,
        encryptFilter: info.info?.EncryptFilterName ?? null,
      });

      if (protectedPdf) {
        throw new DocumentExtractionError(
          "Ce PDF est protégé par un mot de passe ou chiffré. Déposez une version non protégée du document officiel.",
          { reason: "password_protected", pageCount },
        );
      }
    } catch (error) {
      if (error instanceof DocumentExtractionError) throw error;
      if (isPasswordProtectedError(error)) {
        throw new DocumentExtractionError(
          "Ce PDF est protégé par un mot de passe. Déposez une version non protégée du document officiel.",
          { reason: "password_protected", cause: error },
        );
      }
      if (isInvalidPdfError(error)) {
        throw new DocumentExtractionError("Le fichier PDF est corrompu ou n'est pas un PDF valide.", {
          reason: "corrupted_pdf",
          cause: error,
        });
      }

      logPdfExtractionStage("getInfo() indisponible — poursuite avec getText()", {
        cause: rootCauseMessage(error),
      });
    }

    const native = await readNativePdfText(parser, pageCount);
    const nativeText = native.text;
    const perPageChars = native.perPageChars;
    const pagesWithText = perPageChars.filter((page) => page.charCount > 0).length;
    const emptyPages = Math.max(0, (pageCount || perPageChars.length) - pagesWithText);
    const hasTextLayer = pagesWithText > 0 || nativeText.length >= MIN_TOTAL_CHARS;

    logPdfExtractionStage("Texte natif extrait", {
      pageCount: pageCount || perPageChars.length,
      nativeTextLength: nativeText.length,
      pagesWithText,
      emptyPages,
      hasTextLayer,
      perPageChars: perPageChars.slice(0, 5),
      durationMs: Date.now() - startedAt,
    });

    let text = nativeText;
    let extractionMethod: DocumentExtractionResult["extractionMethod"] = "pdf-text";
    let usedOcr = false;
    let ocrPagesProcessed = 0;

    const effectivePageCount = pageCount || perPageChars.length || 1;
    const needsOcr =
      IMPORT_CONFIG.ocr.enabled &&
      isLikelyScannedPdf(nativeText, effectivePageCount, pagesWithText);

    if (needsOcr) {
      logPdfExtractionStage("PDF détecté comme scanné — lancement OCR", {
        pageCount: effectivePageCount,
        nativeTextLength: nativeText.length,
        pagesWithText,
      });

      let screenshots: PdfScreenshot[] = [];
      try {
        screenshots = await capturePageScreenshots(parser, effectivePageCount);
      } catch (error) {
        if (nativeText.trim()) {
          logPdfExtractionStage("Rendu OCR impossible — conservation du texte natif partiel", {
            nativeTextLength: nativeText.length,
            cause: rootCauseMessage(error),
          });
        } else {
          throw new DocumentExtractionError(
            `PDF scanné détecté, mais le rendu des pages pour l'OCR a échoué (${rootCauseMessage(error)}).`,
            {
              reason: "render_failed",
              pageCount: effectivePageCount,
              textLength: nativeText.length,
              cause: error,
            },
          );
        }
      }

      if (screenshots.length === 0 && !nativeText.trim()) {
        throw new DocumentExtractionError(
          "PDF scanné détecté, mais aucune page n'a pu être rendue pour l'OCR.",
          {
            reason: "scanned_pdf",
            pageCount: effectivePageCount,
            textLength: nativeText.length,
            preview: buildPreview(nativeText),
          },
        );
      }

      if (screenshots.length > 0) {
        try {
          const ocrResult = await extractPdfTextWithOcr(screenshots, {
            maxPages: IMPORT_CONFIG.ocr.maxPages,
          });
          ocrPagesProcessed = ocrResult.pagesProcessed;
          const ocrText = normalizeText(ocrResult.text);

          if (!ocrText && !nativeText.trim()) {
            throw new DocumentExtractionError(
              "OCR terminé sans texte exploitable. Le scan est peut-être illisible ou trop compressé.",
              {
                reason: "ocr_failed",
                pageCount: effectivePageCount,
                textLength: 0,
                preview: "",
              },
            );
          }

          text = normalizeText([nativeText, ocrText].filter(Boolean).join("\n\n"));
          extractionMethod = "pdf-ocr";
          usedOcr = true;

          logPdfExtractionStage("OCR terminé", {
            pageCount: effectivePageCount,
            pagesProcessed: ocrResult.pagesProcessed,
            ocrTextLength: ocrText.length,
            finalTextLength: text.length,
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          if (error instanceof DocumentExtractionError) throw error;
          throw new DocumentExtractionError(
            `L'OCR n'a pas pu extraire le texte du PDF scanné (${rootCauseMessage(error)}).`,
            {
              reason: "ocr_failed",
              pageCount: effectivePageCount,
              textLength: nativeText.length,
              cause: error,
            },
          );
        }
      }
    }

    if (!text.trim()) {
      throw new DocumentExtractionError(
        "Aucun texte n'a pu être extrait de ce PDF. Document vide, scanné illisible ou protégé.",
        {
          reason: effectivePageCount > 0 ? "scanned_pdf" : "empty_document",
          pageCount: effectivePageCount,
          textLength: 0,
          preview: "",
        },
      );
    }

    const finalPageCount = effectivePageCount;
    const charsPerPage = finalPageCount > 0 ? Math.round(text.length / finalPageCount) : null;
    const pdfKind: PdfDocumentKind = classifyPdfKind({
      protectedPdf,
      nativeTextLength: nativeText.length,
      pagesWithText,
      usedOcr,
      finalTextLength: text.length,
    });

    const diagnostics: PdfExtractionDiagnostics = {
      fileSizeBytes,
      pageCount: finalPageCount,
      pdfKind,
      hasTextLayer,
      nativeTextLength: nativeText.length,
      finalTextLength: text.length,
      charsPerPage,
      pagesWithText,
      emptyPages,
      durationMs: Date.now() - startedAt,
      extractionMethod,
      usedOcr,
      ocrPagesProcessed,
      perPageChars,
    };

    logPdfExtractionStage("Extraction réussie", diagnostics);

    return {
      text,
      pageCount: finalPageCount,
      textLength: text.length,
      preview: buildPreview(text),
      extractionMethod,
      usedOcr,
      charsPerPage,
      pdfKind,
      hasTextLayer,
      diagnostics,
    };
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      logPdfExtractionFailure(
        {
          reason: error.reason,
          pageCount: error.pageCount,
          textLength: error.textLength,
          durationMs: Date.now() - startedAt,
          fileSizeBytes,
        },
        error.cause ?? error,
      );
      throw error;
    }

    if (isPasswordProtectedError(error)) {
      const wrapped = new DocumentExtractionError(
        "Ce PDF est protégé par un mot de passe. Déposez une version non protégée du document officiel.",
        { reason: "password_protected", cause: error },
      );
      logPdfExtractionFailure({ reason: wrapped.reason, fileSizeBytes }, error);
      throw wrapped;
    }

    if (isInvalidPdfError(error)) {
      const wrapped = new DocumentExtractionError(
        "Le fichier PDF est corrompu ou n'est pas un PDF valide.",
        { reason: "corrupted_pdf", cause: error },
      );
      logPdfExtractionFailure({ reason: wrapped.reason, fileSizeBytes }, error);
      throw wrapped;
    }

    logPdfExtractionFailure({ fileSizeBytes, durationMs: Date.now() - startedAt }, error);

    throw new DocumentExtractionError(buildParserErrorMessage(error), {
      reason: "parser_error",
      cause: error,
    });
  } finally {
    if (parser) {
      await parser.destroy().catch(() => undefined);
    }
  }
}
